using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;

namespace Frame.Jellyfin;

/// <summary>Only the active item's video resources; never a general URL proxy.</summary>
public static partial class RelayPolicy
{
    [GeneratedRegex("^(stream\\.(mp4|m4v|webm)|master\\.m3u8|main\\.m3u8|hls1/[a-z0-9_-]+/-?[0-9]+\\.(ts|mp4|m4s)|hls/[a-z0-9_-]+/(stream\\.m3u8|[0-9]+\\.(ts|mp4|m4s))|[a-z0-9_-]+/subtitles/[0-9]+/([0-9]+/)?stream\\.vtt)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex Tail();
    [GeneratedRegex("^[a-zA-Z0-9_-]{1,12000}$")]
    private static partial Regex Encoded();
    [GeneratedRegex("URI=\"([^\"]*)\"", RegexOptions.CultureInvariant)]
    private static partial Regex PlaylistUri();

    public static string Resource(string raw, Guid item)
    {
        if (raw.Length > 8000 || raw.Contains('#') || raw.Contains('\\') || raw.Any(char.IsControl)) throw new FormatException();
        var parts = raw.Split('?', 2);
        var path = parts[0].Split('/');
        if (path.Length < 3 || !path[0].Equals("Videos", StringComparison.OrdinalIgnoreCase) || !Guid.TryParse(path[1], out var candidate) || candidate != item || !Tail().IsMatch(string.Join('/', path.Skip(2)))) throw new FormatException();
        var query = QueryHelpers.ParseQuery(parts.Length == 2 ? parts[1] : "");
        var playlist = parts[0].EndsWith(".m3u8", StringComparison.OrdinalIgnoreCase) || parts[0].Contains("/hls", StringComparison.OrdinalIgnoreCase);
        return parts[0] + QueryString.Create(query.Where(p => !Regex.IsMatch(p.Key, "^(api_?key|token|access_token|x-emby-token|authorization)$", RegexOptions.IgnoreCase) && !(playlist && p.Key.Equals("StartTimeTicks", StringComparison.OrdinalIgnoreCase)))
            .SelectMany(p => p.Value.Select(v => new KeyValuePair<string, string?>(p.Key, v))));
    }
    public static string Decode(string encoded, Guid item)
    {
        if (!Encoded().IsMatch(encoded)) throw new FormatException();
        return Resource(Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encoded)), item);
    }
    public static string Url(string prefix, string grant, string relative, Guid item) =>
        prefix + "/Frame/Media/" + grant + "/stream?resource=" + WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(Resource(relative, item)));

    public static string Playlist(string text, Uri upstream, string serverBase, string prefix, string grant, Guid item)
    {
        if (!text.TrimStart().StartsWith("#EXTM3U", StringComparison.Ordinal) || text.Length > 1_000_000) throw new FormatException();
        string Rewrite(string raw)
        {
            var uri = new Uri(upstream, raw);
            if (uri.GetLeftPart(UriPartial.Authority) != upstream.GetLeftPart(UriPartial.Authority) || uri.UserInfo.Length != 0 || uri.Fragment.Length != 0) throw new FormatException();
            var path = uri.AbsolutePath;
            var basePath = new Uri(serverBase).AbsolutePath.TrimEnd('/') + "/";
            if (path.StartsWith(basePath, StringComparison.Ordinal)) path = path[basePath.Length..];
            else path = path.TrimStart('/'); // Jellyfin can omit BaseUrl on /Videos paths.
            return Url(prefix, grant, path + uri.Query, item);
        }
        return string.Join('\n', text.Split('\n').Select(line =>
        {
            var value = line.TrimEnd('\r');
            if (string.IsNullOrWhiteSpace(value)) return value;
            return value.StartsWith('#') ? PlaylistUri().Replace(value, m => "URI=\"" + Rewrite(m.Groups[1].Value) + "\"") : Rewrite(value.Trim());
        }));
    }
}
