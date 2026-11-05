using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Frame.Jellyfin;

/// <summary>Same-server, user-authorized, item-scoped streaming. No account token in media URLs.</summary>
[ApiController]
[Authorize]
[Route("Frame/Media")]
public sealed class FrameMediaController(IServer server) : ControllerBase
{
    private static readonly HttpClient Upstream = new(new SocketsHttpHandler { AllowAutoRedirect = false, UseCookies = false, UseProxy = false }) { Timeout = Timeout.InfiniteTimeSpan };
    public sealed record OpenRequest(Guid ItemId);
    private bool SameOrigin()
    {
        var origin = Request.Headers.Origin.ToString();
        var expected = Request.Scheme + "://" + Request.Host;
        var site = Request.Headers["Sec-Fetch-Site"].ToString();
        return (origin.Length == 0 || origin == expected) && site is not ("cross-site" or "same-site");
    }
    private bool ControlRequest() => SameOrigin() && Request.Headers["X-Frame-Request"] == "1" && Request.Headers.Origin == Request.Scheme + "://" + Request.Host;
    private string? ServerBase()
    {
        // The accepted local HTTP socket works even when Kestrel uses explicit Listen
        // endpoints and its advertised IServerAddressesFeature collection is empty.
        var socket = RelayEndpoint.Resolve(Request);
        if (socket is not null) return socket;
        // Never derive an upstream destination from Host, forwarded headers, JSON or a query URL.
        foreach (var address in server.Features.Get<IServerAddressesFeature>()?.Addresses ?? [])
        {
            if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) || uri.Scheme != "http" || uri.Port <= 0) continue;
            if (uri.Host is not ("127.0.0.1" or "localhost" or "0.0.0.0" or "[::]" or "::")) continue;
            var loopback = uri.Host.Contains(':') ? "[::1]" : "127.0.0.1";
            var path = Request.PathBase.Value ?? "";
            if (path.Split('/').Any(p => p is "." or ".." || p.Contains('%') || p.Contains('\\'))) return null;
            return "http://" + loopback + ":" + uri.Port + path;
        }
        return null;
    }
    private static HttpRequestMessage Message(HttpMethod method, string url, string authorization)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.TryAddWithoutValidation("Authorization", authorization);
        request.Headers.TryAddWithoutValidation("Accept", "application/json; profile=PascalCase");
        return request;
    }
    private static async Task<string?> AuthorizedOwner(string baseUrl, string authorization, Guid item, CancellationToken cancellation)
    {
        if (authorization.Length is 0 or > 4096) return null;
        using var user = await ProtectedJson(baseUrl + "/Users/Me", authorization, cancellation).ConfigureAwait(false);
        if (user is null) return null;
        if (!user.RootElement.TryGetProperty("Id", out var id) || !Guid.TryParse(id.GetString(), out var owner)) return null;
        if (!user.RootElement.TryGetProperty("Policy", out var policy) || !policy.TryGetProperty("EnableMediaPlayback", out var playback) || playback.ValueKind != JsonValueKind.True) return null;
        using var media = await ProtectedJson(baseUrl + "/Items/" + item.ToString("N") + "?userId=" + owner.ToString("N"), authorization, cancellation).ConfigureAwait(false);
        if (media is null) return null;
        if (!media.RootElement.TryGetProperty("Type", out var type) || type.GetString() is not ("Movie" or "Episode")) return null;
        if (media.RootElement.TryGetProperty("PlayAccess", out var access) && access.GetString() != "Full") return null;
        return owner.ToString("N");
    }
    private static async Task<JsonDocument?> ProtectedJson(string url, string authorization, CancellationToken cancellation)
    {
        using var request = Message(HttpMethod.Get, url, authorization);
        using var response = await Upstream.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellation).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return null;
        await using var body = await response.Content.ReadAsStreamAsync(cancellation).ConfigureAwait(false);
        using var buffer = new MemoryStream(); var bytes = new byte[8192]; int read;
        while ((read = await body.ReadAsync(bytes, cancellation).ConfigureAwait(false)) > 0)
        {
            if (buffer.Length + read > 2_000_000) throw new HttpRequestException("Authorization response too large.");
            buffer.Write(bytes, 0, read);
        }
        return JsonDocument.Parse(buffer.ToArray());
    }
    private string CookieName(string id) => "FrameMedia_" + id;
    private CookieOptions Cookie(RelayGrant grant) => new() { HttpOnly = true, Secure = Request.IsHttps, SameSite = SameSiteMode.Strict, IsEssential = true, Path = grant.PathBase + "/Frame/Media/" + grant.Id + "/", MaxAge = TimeSpan.FromMinutes(2) };
    private void PrivateHeaders() { Response.Headers.CacheControl = "no-store"; Response.Headers["Referrer-Policy"] = "no-referrer"; Response.Headers["X-Content-Type-Options"] = "nosniff"; }

    [HttpPost]
    public async Task<IActionResult> Open([FromBody] OpenRequest body)
    {
        PrivateHeaders();
        if (!ControlRequest()) return StatusCode(400, new { code = "frame-relay-origin" });
        if (body.ItemId == Guid.Empty) return StatusCode(400, new { code = "frame-relay-item" });
        var baseUrl = ServerBase(); if (baseUrl is null) return StatusCode(503, new { code = "frame-relay-listener" });
        var authorization = Request.Headers.Authorization.ToString();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(Request.HttpContext.RequestAborted); timeout.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            var owner = await AuthorizedOwner(baseUrl, authorization, body.ItemId, timeout.Token).ConfigureAwait(false);
            if (owner is null) return Forbid();
            var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var grant = new RelayGrant { Id = Guid.NewGuid().ToString("N"), Item = body.ItemId, Owner = owner, Authorization = authorization, ServerBase = baseUrl, PathBase = Request.PathBase.Value ?? "", CookieHash = SHA256.HashData(Encoding.UTF8.GetBytes(secret)) };
            if (!RelayGrants.Add(grant)) { grant.Dispose(); return StatusCode(429); }
            Response.Cookies.Append(CookieName(grant.Id), secret, Cookie(grant));
            return Ok(new { grantId = grant.Id, expiresIn = 120 });
        }
        catch (HttpRequestException) { return StatusCode(502, new { code = "frame-relay-upstream" }); }
        catch (OperationCanceledException) { return StatusCode(504, new { code = "frame-relay-timeout" }); }
        catch (JsonException) { return StatusCode(502, new { code = "frame-relay-response" }); }
    }

    [HttpPut("{id}/lease")]
    public async Task<IActionResult> Renew(string id)
    {
        PrivateHeaders(); var grant = RelayGrants.Find(id);
        if (!ControlRequest() || grant is null || !grant.Matches(Request.Cookies[CookieName(id)]) || Request.Headers.Authorization != grant.Authorization) return NotFound();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(Request.HttpContext.RequestAborted); timeout.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            if (await AuthorizedOwner(grant.ServerBase, grant.Authorization, grant.Item, timeout.Token).ConfigureAwait(false) != grant.Owner) { RelayGrants.Remove(id); return Forbid(); }
            if (grant.Lifetime.IsCancellationRequested) return NotFound();
            grant.Renew(); Response.Cookies.Append(CookieName(id), Request.Cookies[CookieName(id)]!, Cookie(grant)); return NoContent();
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException or JsonException) { return StatusCode(502); }
    }

    [HttpDelete("{id}/lease")]
    public IActionResult Close(string id)
    {
        PrivateHeaders(); var grant = RelayGrants.Find(id);
        if (!ControlRequest() || grant is null || !grant.Matches(Request.Cookies[CookieName(id)]) || Request.Headers.Authorization != grant.Authorization) return NotFound();
        RelayGrants.Remove(id); Response.Cookies.Delete(CookieName(id), Cookie(grant)); return NoContent();
    }

    // Intentionally bypass the general account auth middleware ONLY here. A short-lived
    // HttpOnly capability cookie is mandatory, and the original user's auth is checked
    // against Jellyfin's protected account/item APIs before EVERY read. Some Jellyfin
    // stream endpoints accept anonymous reads, so forwarding a header is insufficient.
    // The grant ID in the path is not a secret.
    [AllowAnonymous]
    [HttpGet("{id}/stream")]
    [HttpHead("{id}/stream")]
    public async Task Stream(string id, [FromQuery] string resource)
    {
        PrivateHeaders(); var grant = RelayGrants.Find(id);
        if (!SameOrigin() || grant is null || !grant.Matches(Request.Cookies[CookieName(id)])) { Response.StatusCode = 404; return; }
        string relative;
        try { relative = RelayPolicy.Decode(resource, grant.Item); } catch (FormatException) { Response.StatusCode = 400; return; }
        if (!await grant.Slots.WaitAsync(0).ConfigureAwait(false)) { Response.StatusCode = 429; return; }
        using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(Request.HttpContext.RequestAborted, grant.Lifetime.Token);
        try
        {
            using var authorizationTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation.Token);
            authorizationTimeout.CancelAfter(TimeSpan.FromSeconds(15));
            if (await AuthorizedOwner(grant.ServerBase, grant.Authorization, grant.Item, authorizationTimeout.Token).ConfigureAwait(false) != grant.Owner)
            {
                RelayGrants.Remove(id); Response.StatusCode = 403; return;
            }
            var url = grant.ServerBase + "/" + relative;
            using var request = Message(HttpMethods.IsHead(Request.Method) ? HttpMethod.Head : HttpMethod.Get, url, grant.Authorization);
            foreach (var name in new[] { "Range", "If-Range" }) if (Request.Headers.TryGetValue(name, out var value)) request.Headers.TryAddWithoutValidation(name, value.ToString());
            using var response = await Upstream.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellation.Token).ConfigureAwait(false);
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) { RelayGrants.Remove(id); Response.StatusCode = (int)response.StatusCode; return; }
            if (response.StatusCode is not (HttpStatusCode.OK or HttpStatusCode.PartialContent)) { Response.StatusCode = 502; return; }
            if (response.StatusCode == HttpStatusCode.PartialContent && response.Content.Headers.ContentRange is null) { Response.StatusCode = 502; return; }
            Response.StatusCode = (int)response.StatusCode;
            var playlist = relative.Split('?')[0].EndsWith(".m3u8", StringComparison.OrdinalIgnoreCase);
            if (playlist && !HttpMethods.IsHead(Request.Method))
            {
                if (response.Content.Headers.ContentLength > 1_000_000) { Response.StatusCode = 502; return; }
                await using var body = await response.Content.ReadAsStreamAsync(cancellation.Token).ConfigureAwait(false);
                using var buffer = new MemoryStream(); var bytes = new byte[8192]; int read;
                while ((read = await body.ReadAsync(bytes, cancellation.Token).ConfigureAwait(false)) > 0) { if (buffer.Length + read > 1_000_000) throw new FormatException(); buffer.Write(bytes, 0, read); }
                var text = RelayPolicy.Playlist(Encoding.UTF8.GetString(buffer.ToArray()), new Uri(url), grant.ServerBase, grant.PathBase, id, grant.Item);
                Response.ContentType = "application/vnd.apple.mpegurl"; await Response.WriteAsync(text, cancellation.Token).ConfigureAwait(false); return;
            }
            Response.ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
            Response.ContentLength = response.Content.Headers.ContentLength;
            if (response.Content.Headers.ContentRange is { } range) Response.Headers.ContentRange = range.ToString();
            if (response.Headers.AcceptRanges.Count > 0) Response.Headers.AcceptRanges = string.Join(",", response.Headers.AcceptRanges);
            if (response.Headers.ETag is { } tag) Response.Headers.ETag = tag.ToString();
            if (!HttpMethods.IsHead(Request.Method)) await response.Content.CopyToAsync(Response.Body, cancellation.Token).ConfigureAwait(false);
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException or IOException or FormatException or JsonException)
        {
            if (!Response.HasStarted) { Response.ContentLength = null; Response.StatusCode = 502; } else HttpContext.Abort();
        }
        finally { grant.Slots.Release(); }
    }
}
