using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Frame.Jellyfin;

internal sealed class RelayGrant : IDisposable
{
    public required string Id { get; init; }
    public required Guid Item { get; init; }
    public required string Owner { get; init; }
    public required string Authorization { get; set; }
    public required string ServerBase { get; init; }
    public required string PathBase { get; init; }
    public required byte[] CookieHash { get; init; }
    private long expiresTicks;
    public DateTimeOffset Expires => new(Interlocked.Read(ref expiresTicks), TimeSpan.Zero);
    public CancellationTokenSource Lifetime { get; } = new();
    public SemaphoreSlim Slots { get; } = new(8);
    public void Renew() { Interlocked.Exchange(ref expiresTicks, DateTimeOffset.UtcNow.AddMinutes(2).Ticks); Lifetime.CancelAfter(TimeSpan.FromMinutes(2)); }
    public bool Matches(string? cookie) => cookie is { Length: 64 } && CryptographicOperations.FixedTimeEquals(CookieHash, SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(cookie)));
    public void Dispose() { Lifetime.Cancel(); Authorization = ""; } // In-flight readers still own the token and slots.
}

internal static class RelayGrants
{
    private static readonly ConcurrentDictionary<string, RelayGrant> Grants = new();
    private static readonly object Gate = new();
    private static readonly Timer Cleanup = new(_ => Prune(), null, 30_000, 30_000);
    public static void Prune()
    {
        foreach (var pair in Grants) if (pair.Value.Expires <= DateTimeOffset.UtcNow) Remove(pair.Key);
    }
    public static RelayGrant? Find(string id)
    {
        if (id.Length != 32 || !id.All(char.IsAsciiHexDigit)) return null;
        if (!Grants.TryGetValue(id, out var grant)) return null;
        if (grant.Expires <= DateTimeOffset.UtcNow || grant.Lifetime.IsCancellationRequested) { Remove(id); return null; }
        return grant;
    }
    public static bool Add(RelayGrant grant)
    {
        lock (Gate)
        {
            Prune();
            if (Grants.Count >= 128 || Grants.Values.Count(g => g.Owner == grant.Owner) >= 4) return false;
            grant.Renew();
            return Grants.TryAdd(grant.Id, grant);
        }
    }
    public static void Remove(string id) { if (Grants.TryRemove(id, out var grant)) grant.Dispose(); }
}
