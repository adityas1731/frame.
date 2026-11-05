using MediaBrowser.Common.Plugins;

namespace Frame.Jellyfin;

/// <summary>Web client and an item-scoped streaming relay; no metadata or administrative mutation services.</summary>
public sealed class FramePlugin : BasePlugin
{
    public FramePlugin()
    {
        // The non-configurable base class does not initialize assembly attributes itself.
        var assembly = typeof(FramePlugin).Assembly;
        SetAttributes(assembly.Location, Path.GetDirectoryName(assembly.Location)!, assembly.GetName().Version!);
    }
    public override string Name => "Frame";
    public override string Description => "Frame Cinema web client. Open Frame/Web/ on this Jellyfin server.";
    public override Guid Id => new("1c38ef02-2393-4f54-a18b-fcfcbf394d65");
}
