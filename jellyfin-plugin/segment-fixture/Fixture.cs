using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.MediaSegments;
using MediaBrowser.Model;
using MediaBrowser.Model.MediaSegments;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Frame.SegmentFixture;

public sealed class FixtureRegistration : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection services, IServerApplicationHost applicationHost)
        => services.AddSingleton<IMediaSegmentProvider, FixtureProvider>();
}

// Test-only discovery adapter. Never included by the Frame package builder.
// No extraction, scan, requests, file access, metadata writes or production behavior.
public sealed class FixturePlugin : BasePlugin
{
    public FixturePlugin()
    {
        var assembly = typeof(FixturePlugin).Assembly;
        SetAttributes(assembly.Location, Path.GetDirectoryName(assembly.Location)!, assembly.GetName().Version!);
    }
    public override string Name => "Frame Synthetic Segment Fixture";
    public override string Description => "Disposable test instance only; not a release plugin.";
    public override Guid Id => new("f0080000-0000-4000-8000-000000000008");
}

public sealed class FixtureProvider : IMediaSegmentProvider
{
    public string Name => "Frame Synthetic Segment Fixture";
    public Task<IReadOnlyList<MediaSegmentDto>> GetMediaSegments(MediaSegmentGenerationRequest request, CancellationToken cancellationToken)
        => Task.FromResult(request.ExistingSegments);
    public ValueTask<bool> Supports(BaseItem item) => ValueTask.FromResult(item.Name is "Frame Test Film" or "First Signal");
    public Task CleanupExtractedData(Guid itemId, CancellationToken cancellationToken) => Task.CompletedTask;
}

