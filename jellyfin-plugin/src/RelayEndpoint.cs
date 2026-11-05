using System.Net;
using Microsoft.AspNetCore.Http;

namespace Frame.Jellyfin;

/// <summary>Resolve only the socket that accepted this request, never client/forwarded hosts.</summary>
public static class RelayEndpoint
{
    public static string? Resolve(HttpRequest request)
    {
        var connection = request.HttpContext.Connection;
        var address = connection.LocalIpAddress;
        var path = request.PathBase.Value ?? "";
        if (request.IsHttps || connection.LocalPort is <= 0 or > 65535 || address is null ||
            address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any) ||
            path.Split('/').Any(p => p is "." or ".." || p.Contains('%') || p.Contains('\\'))) return null;
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        var host = address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6
            ? "[" + address + "]" : address.ToString();
        return "http://" + host + ":" + connection.LocalPort + path;
    }
}
