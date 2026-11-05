using System.Reflection;
using System.Security.Cryptography;

namespace Frame.Jellyfin;

/// <summary>Exact embedded resource lookup. Request paths never reach the filesystem.</summary>
public static class WebAssets
{
    private static readonly Lazy<IReadOnlyDictionary<string, WebAsset>> Assets = new(Load);
    public static bool IsSafePath(string path) => path.Length <= 512
        && !path.Contains('%') && !path.Contains('\\') && !path.Contains(':')
        && !path.Any(char.IsControl) && !path.StartsWith('/')
        && path.Split('/').All(segment => segment.Length > 0 && !segment.StartsWith('.'));

    public static WebAsset? Find(string path) => IsSafePath(path) && Assets.Value.TryGetValue(path, out var asset) ? asset : null;

    private static IReadOnlyDictionary<string, WebAsset> Load()
    {
        var assembly = typeof(FramePlugin).Assembly;
        var result = new Dictionary<string, WebAsset>(StringComparer.Ordinal);
        foreach (var resource in assembly.GetManifestResourceNames().Where(name => name.StartsWith("Frame.Web/", StringComparison.Ordinal)))
        {
            var path = resource["Frame.Web/".Length..];
            if (!IsSafePath(path) || ContentType(path) is not { } type) continue;
            using var stream = assembly.GetManifestResourceStream(resource)!;
            using var buffer = new MemoryStream();
            stream.CopyTo(buffer);
            var bytes = buffer.ToArray();
            result.Add(path, new(bytes, type, '"' + Convert.ToHexString(SHA256.HashData(bytes)) + '"'));
        }
        return result;
    }

    public static string? ContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".js" => "text/javascript; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".woff" => "font/woff",
        ".woff2" => "font/woff2",
        ".ttf" => "font/ttf",
        ".json" when path == "build-info.json" => "application/json; charset=utf-8",
        _ when path.StartsWith("licenses/", StringComparison.Ordinal) || path == "THIRD-PARTY-NOTICES.md" => "text/plain; charset=utf-8",
        _ => null
    };
}

public sealed record WebAsset(byte[] Bytes, string ContentType, string ETag);
