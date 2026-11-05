# Third-party dependency and asset notices

Only the npm packages approved by the user and their required transitive dependencies were installed. Exact versions and registry integrity hashes are retained in `package-lock.json`. The FRAME-009 QR component was separately approved; no other QR library or external QR-generation service is used. No additional icon, font, animation, testing or image packages were installed.

## Application dependency closure (including type-only peers)

| Package | Version | Declared license | Retained license/notice files |
| --- | --- | --- | --- |
| `@remix-run/route-pattern` | 0.22.1 | MIT | [remix-run-route-pattern-LICENSE](licenses/remix-run-route-pattern-LICENSE) |
| `@types/react` | 19.3.0 | MIT | [types-react-LICENSE](licenses/types-react-LICENSE) |
| `@types/react-dom` | 19.3.0 | MIT | [types-react-dom-LICENSE](licenses/types-react-dom-LICENSE) |
| `cookie-es` | 3.1.1 | MIT | [cookie-es-LICENSE](licenses/cookie-es-LICENSE) |
| `csstype` | 3.2.3 | MIT | [csstype-LICENSE](licenses/csstype-LICENSE) |
| `hls.js` | 1.7.3 | Apache-2.0 | [upstream copyright](licenses/hls-js-LICENSE), [full license](licenses/Apache-2.0.txt) |
| `lucide-react` | 1.61.0 | ISC | [lucide-react-LICENSE](licenses/lucide-react-LICENSE) |
| `qrcode.react` | 4.2.0 | ISC; bundled encoder MIT | [component license](licenses/qrcode-react-LICENSE), [encoder license](licenses/qrcodegen-MIT-LICENSE) |
| `react` | 19.3.1 | MIT | [react-LICENSE](licenses/react-LICENSE) |
| `react-dom` | 19.3.1 | MIT | [react-dom-LICENSE](licenses/react-dom-LICENSE) |
| `react-router` | 8.5.0 | MIT | [react-router-LICENSE.md](licenses/react-router-LICENSE.md) |
| `scheduler` | 0.28.0 | MIT | [scheduler-LICENSE](licenses/scheduler-LICENSE) |

License files above are copied from the freshly installed upstream packages, not from Jeva. Review them before redistributing a derivative build. Development-tool and platform-binary licenses remain in their installed package directories and are recorded in the lockfile; those tools are not application runtime dependencies.

## Provider attribution mark

`public/providers/tmdb.svg` is the existing TMDB provider attribution mark, not original Frame artwork or a Jeva asset. TMDB retains its branding/trademark rights. Its inclusion does not grant rights to redistribute movie/show artwork or imply endorsement. Provider branding/attribution terms and intended public distribution must be reviewed before publication; the project remains private pending explicit owner approval.

## Original Frame content

All fictional catalog data and application copy in `src/data/media.ts`, procedural illustrations in `src/components/Artwork.tsx`, preview branding/favicon and application CSS were newly authored for this project. No externally hosted media, extracted artwork, translations, stylesheets or fonts are included. System font stacks use the browser/deviceâ€™s existing font installation. No Jeva-specific license grant is assumed.

## FRAME-005 original playback test media

`public/test-media` contains new FFmpeg lavfi test-pattern/sine-wave video/audio, WebVTT cues and stream-copy HLS derivatives. The original media/captions are dedicated under CC0-1.0 as documented there. No movie, show, soundtrack or Jeva asset is included. The installed Jellyfin FFmpeg tool generated these assets; its executable is not redistributed. hls.js 1.7.3 was explicitly approved and installed with no new transitive runtime packages. The full Apache-2.0 text and supplied upstream copyright/license notice are retained in licenses/. No separate upstream NOTICE file was supplied in the npm package.
