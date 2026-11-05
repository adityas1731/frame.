using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MediaBrowser.Common.Plugins;

if (args.Length is not (3 or 4)) throw new ArgumentException("assembly, staged web directory, profile, optional expected version required");
var assembly = Assembly.LoadFrom(Path.GetFullPath(args[0]));
var stage = Path.GetFullPath(args[1]);
var profile = args[2];
if (profile is not ("release" or "diagnostics")) throw new ArgumentException("Invalid profile");
var plugin = (IPlugin)Activator.CreateInstance(assembly.GetType("Frame.Jellyfin.FramePlugin", true)!)!;
if (plugin.Name != "Frame" || plugin.Version is null || plugin.Id != new Guid("1c38ef02-2393-4f54-a18b-fcfcbf394d65")) throw new Exception("Invalid plugin identity / assembly initialization");
_ = plugin.GetPluginInfo();
if (args.Length == 4 && plugin.Version.ToString() != args[3]) throw new Exception("Compiled assembly version mismatch");
var resources = assembly.GetManifestResourceNames().Where(n => n.StartsWith("Frame.Web/", StringComparison.Ordinal)).ToArray();
var expected = Directory.GetFiles(stage, "*", SearchOption.AllDirectories).Select(f => Path.GetRelativePath(stage, f).Replace('\\','/')).Order().ToArray();
if (!resources.Select(n => n["Frame.Web/".Length..]).Order().SequenceEqual(expected)) throw new Exception("Unexpected or missing embedded web assets");
var markers = new[] {"frame-playback-diagnostics-v1", "Copy diagnostic report", "Playback diagnostics", "settings/advanced/diagnostics", "diagnostics-panel", "diagnostics-summary"};
var combined = new StringBuilder();
var hashes = new SortedDictionary<string,string>();
foreach (var name in resources)
{
    using var stream = assembly.GetManifestResourceStream(name)!;
    using var memory = new MemoryStream();stream.CopyTo(memory);var bytes=memory.ToArray();
    var path=name["Frame.Web/".Length..];
    var original=File.ReadAllBytes(Path.Combine(stage,path));
    if (!bytes.SequenceEqual(original)) throw new Exception("Embedded asset differs from verified stage: "+path);
    hashes[path]=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    if (new[]{".js",".css",".html",".json"}.Contains(Path.GetExtension(path)))combined.Append(Encoding.UTF8.GetString(bytes));
}
using var info=JsonDocument.Parse(File.ReadAllBytes(Path.Combine(stage,"build-info.json")));
if(info.RootElement.GetProperty("profile").GetString()!=profile || info.RootElement.GetProperty("diagnostics").GetBoolean()!=(profile=="diagnostics"))throw new Exception("Embedded profile mismatch");
foreach(var marker in markers)if(combined.ToString().Contains(marker)!=(profile=="diagnostics"))throw new Exception("Embedded diagnostics isolation failed: "+marker);
Console.WriteLine(JsonSerializer.Serialize(new {format="frame-embedded-verification-v1",profile,assemblyVersion=plugin.Version.ToString(),resourceCount=resources.Length,identityInitialized=true,diagnostics=profile=="diagnostics",hashes}));
