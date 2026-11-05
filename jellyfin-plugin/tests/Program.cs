using Frame.Jellyfin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Text;

static void Check(bool valid, string label) { if (!valid) throw new Exception(label); Console.WriteLine("PASS " + label); }
static FrameWebController Host(string uri, string pathBase = "", string method = "GET")
{
    var context = new DefaultHttpContext();
    context.Request.PathBase = pathBase; context.Request.Path = uri; context.Request.Method = method;
    return new FrameWebController { ControllerContext = new ControllerContext { HttpContext = context } };
}
foreach (var path in new[] { "../secret", ".env", "a/../b", "a//b", "a\\b", "C:/secret", "%2e%2e/secret", "a/%252e", "/assets/test-hash.js", "a\0b" })
    Check(!WebAssets.IsSafePath(path), "reject path " + path.Replace('\0','?'));
Check(WebAssets.Find(".env") is null, "embedded dotfiles cannot be served");
Check(WebAssets.Find("assets/missing.js") is null, "missing resources fail closed");
var host = Host("/Frame/Web/", "/jellyfin");
var index = host.Get(null) as FileContentResult;
Check(index is not null && Encoding.UTF8.GetString(index.FileContents).Contains("<base href=\"/jellyfin/Frame/Web/\""), "HTML uses proxy PathBase");
Check(host.Response.Headers.CacheControl == "no-store", "HTML cannot become stale immutable content");
Check(Host("/Frame/Web").Get(null) is RedirectResult { Url: "/Frame/Web/" }, "canonical trailing slash");
Check(Host("/Frame/Web/item/abc", "/jellyfin").Get("item/abc") is RedirectResult { Url: "/jellyfin/Frame/Web/#/item/abc" }, "nested route refresh canonicalizes to hash router");
Check(Host("/Frame/Web/assets/missing.js").Get("assets/missing.js") is NotFoundResult, "missing assets are not SPA HTML");
var js = Host("/Frame/Web/assets/test-hash.js");
Check(js.Get("assets/test-hash.js") is FileContentResult { ContentType: "text/javascript; charset=utf-8" }, "JavaScript MIME");
Check(js.Response.Headers.CacheControl.ToString().Contains("immutable"), "hashed assets are immutable");
var cached = Host("/Frame/Web/assets/test-hash.js");cached.Request.Headers.IfNoneMatch = js.Response.Headers.ETag;
Check(cached.Get("assets/test-hash.js") is StatusCodeResult { StatusCode: 304 }, "ETag revalidation");
var worker = Host("/Frame/Web/frame-stream-sw.js", "/jellyfin", "HEAD");
Check(worker.Get("frame-stream-sw.js") is EmptyResult && worker.Response.ContentType == "text/javascript; charset=utf-8", "HEAD retains MIME without body");
Check(worker.Response.Headers["Service-Worker-Allowed"] == "/jellyfin/Frame/Web/" && worker.Response.Headers.CacheControl == "no-store", "worker stays in plugin scope");
RelayTests.Run(Check);
Console.WriteLine("Host and relay policy tests passed. This harness does not prove Jellyfin 12 integration.");

namespace Frame.Jellyfin { public sealed class FramePlugin { } }
