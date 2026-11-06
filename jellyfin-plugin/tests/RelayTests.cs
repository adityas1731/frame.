using System.Text;
using Frame.Jellyfin;
using Microsoft.AspNetCore.WebUtilities;

static class RelayTests
{
    public static void Run(Action<bool, string> check)
    {
        var socket = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        socket.Connection.LocalIpAddress = System.Net.IPAddress.Parse("192.0.2.20");
        socket.Connection.LocalPort = 18096; socket.Request.Scheme = "http";
        socket.Request.Host = new Microsoft.AspNetCore.Http.HostString("outside.invalid:9999");
        socket.Request.PathBase = "/jellyfin";
        check(RelayEndpoint.Resolve(socket.Request) == "http://192.0.2.20:18096/jellyfin", "relay uses actual local socket without advertised listeners or client Host");
        socket.Request.Headers["X-Forwarded-Host"] = "attacker.invalid";
        socket.Request.Headers["X-Forwarded-Port"] = "1234";
        check(RelayEndpoint.Resolve(socket.Request) == "http://192.0.2.20:18096/jellyfin", "forwarded hosts cannot select relay upstream");
        socket.Connection.LocalIpAddress = System.Net.IPAddress.IPv6Loopback;
        check(RelayEndpoint.Resolve(socket.Request) == "http://[::1]:18096/jellyfin", "relay formats IPv6 local socket safely");
        socket.Request.Scheme = "https";
        check(RelayEndpoint.Resolve(socket.Request) is null, "relay never sends plaintext HTTP to a TLS socket");
        socket.Request.Scheme = "http"; socket.Connection.LocalIpAddress = System.Net.IPAddress.Any;
        check(RelayEndpoint.Resolve(socket.Request) is null, "relay rejects unspecified socket addresses");
        var item = Guid.NewGuid(); var other = Guid.NewGuid();
        var root = "Videos/" + item.ToString("N");
        check(RelayPolicy.Resource(root + "/master.m3u8?ApiKey=secret&StartTimeTicks=100&VideoCodec=h264", item) == root + "/master.m3u8?VideoCodec=h264", "relay strips broad credentials and HLS start offset");
        check(RelayPolicy.Decode(WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(root + "/stream.mp4?static=true")), item).Contains("static=true"), "relay accepts encoded active-item resource");
        foreach (var raw in new[] { "../secret", "http://outside.invalid/secret", "Videos/" + other.ToString("N") + "/stream.mp4", root + "/%2e%2e/stream.mp4", root + "/stream.mp4#token", root + "/file.mkv", root + "/../stream.mp4", root + "/Subtitles/1/stream.vtt" })
        {
            var rejected = false; try { RelayPolicy.Resource(raw, item); } catch (FormatException) { rejected = true; }
            check(rejected, "relay rejects unsupported/unscoped media path");
        }
        var upstream = new Uri("http://127.0.0.1:18096/jellyfin/" + root + "/master.m3u8");
        var text = RelayPolicy.Playlist("#EXTM3U\n#EXT-X-MAP:URI=\"hls1/main/-1.mp4?api_key=secret\"\nhls1/main/0.ts?ApiKey=secret\n", upstream, "http://127.0.0.1:18096/jellyfin", "/jellyfin", "grant", item);
        check(!text.Contains("secret") && text.Split('\n')[2].StartsWith("/jellyfin/Frame/Media/grant/stream?resource="), "relay rewrites HLS map and segment under BaseUrl without credentials");
        // Long VOD playlists repeat negotiation options on every segment URL.
        // A feature-length film can exceed 1 MB before any segment is requested.
        var longPlaylist = "#EXTM3U\n" + string.Concat(Enumerable.Range(0, 1700).Select(n =>
            "#EXTINF:6.000,\nhls1/main/" + n + ".ts?VideoCodec=h264&TranscodeReasons=" + new string('x', 650) + "\n"));
        check(Encoding.UTF8.GetByteCount(longPlaylist) > 1_000_000, "long VOD fixture exceeds the previous playlist limit");
        var longRewritten = RelayPolicy.Playlist(longPlaylist, upstream, "http://127.0.0.1:18096/jellyfin", "/jellyfin", "grant", item);
        check(longRewritten.Split('\n').Count(line => line.StartsWith("/jellyfin/Frame/Media/grant/stream?resource=")) == 1700,
            "feature-length VOD playlist rewrites every segment without truncation");
        foreach (var excessive in new[] { "#EXTM3U\n" + new string(' ', 8 * 1024 * 1024), "#EXTM3U\n#" + new string('\u00e9', 4 * 1024 * 1024) })
        {
            var rejected = false; try { RelayPolicy.Playlist(excessive, upstream, "http://127.0.0.1:18096/jellyfin", "", "grant", item); } catch (FormatException) { rejected = true; }
            check(rejected, "playlist byte budget remains bounded including multibyte text");
        }
        foreach (var uri in new[] { "http://outside.invalid/stream.ts", "/Videos/" + other.ToString("N") + "/master.m3u8", "../../../System/Info" })
        {
            var rejected = false; try { RelayPolicy.Playlist("#EXTM3U\n" + uri, upstream, "http://127.0.0.1:18096/jellyfin", "/jellyfin", "grant", item); } catch (FormatException) { rejected = true; }
            check(rejected, "relay rejects hostile HLS resource");
        }
        var secret = new string('a', 64);
        var grant = new RelayGrant { Id = Guid.NewGuid().ToString("N"), Item = item, Owner = "test-owner", Authorization = "test-only", ServerBase = "http://127.0.0.1:18096", PathBase = "", CookieHash = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(secret)) };
        check(RelayGrants.Add(grant), "relay accepts bounded grant");
        check(grant.Matches(secret) && !grant.Matches(new string('b', 64)) && !grant.Matches(null), "relay cookie comparison requires exact secret");
        check(grant.Expires > DateTimeOffset.UtcNow && grant.Expires < DateTimeOffset.UtcNow.AddSeconds(121), "relay lease is time bounded");
        grant.Lifetime.Cancel(); check(RelayGrants.Find(grant.Id) is null, "expired/cancelled grant cannot be reused");
    }
}
