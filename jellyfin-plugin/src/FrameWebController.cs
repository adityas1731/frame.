using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;

namespace Frame.Jellyfin;

/// <summary>Anonymous static UI only. Jellyfin's own API authenticates every private operation.</summary>
[ApiController]
[AllowAnonymous]
[Route("Frame/Web")]
public sealed class FrameWebController : ControllerBase
{
    [HttpGet("{**path}")]
    [HttpHead("{**path}")]
    public IActionResult Get(string? path)
    {
        var root = Request.PathBase.Add("/Frame/Web/").Value!;
        if (string.IsNullOrEmpty(path))
        {
            if (!Request.Path.Value!.EndsWith('/')) return Redirect(root);
            path = "index.html";
        }
        if (!WebAssets.IsSafePath(path)) return NotFound();
        var asset = WebAssets.Find(path);
        if (asset is null)
        {
            // Frame uses hash routing: canonicalize extensionless deep links, never mask missing assets.
            if (!path.Split('/').Any(segment => segment.Contains('.')))
                return Redirect(root + "#/" + string.Join('/', path.Split('/').Select(Uri.EscapeDataString)));
            return NotFound();
        }
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        var html = path == "index.html";
        var worker = path is "frame-stream-sw.js" or "frame-stream-policy.js";
        Response.Headers.CacheControl = html || worker || path == "build-info.json" ? "no-store" :
            path.StartsWith("assets/", StringComparison.Ordinal) ? "public, max-age=31536000, immutable" : "public, max-age=3600";
        if (worker) Response.Headers["Service-Worker-Allowed"] = root;
        var bytes = html ? Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(asset.Bytes)
            .Replace("<base href=\"./\"", "<base href=\"" + WebUtility.HtmlEncode(root) + "\"", StringComparison.Ordinal)) : asset.Bytes;
        if (!html)
        {
            Response.Headers.ETag = asset.ETag;
            if (Request.Headers.IfNoneMatch.Any(value => value == asset.ETag)) return StatusCode(304);
        }
        Response.ContentLength = bytes.Length;
        Response.ContentType = asset.ContentType;
        if (HttpMethods.IsHead(Request.Method)) return new EmptyResult();
        return File(bytes, asset.ContentType);
    }
}
