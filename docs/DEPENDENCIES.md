# Dependency Review

The release uses the exact versions and integrity hashes in `ui-preview/package-lock.json`. The matching dependency-source ZIP includes unchanged registry packages, preferred upstream source, build files, license texts and a file-level source index.

| Dependency | Version | License |
| --- | --- | --- |
| React / React DOM | 19.3.1 | MIT |
| Scheduler | 0.28.0 | MIT |
| React Router | 8.5.0 | MIT |
| @remix-run/route-pattern | 0.22.1 | MIT |
| cookie-es | 3.1.1 | MIT |
| hls.js | 1.7.3 | Apache-2.0 |
| lucide-react | 1.61.0 | ISC |
| qrcode.react / bundled QR encoder | 4.2.0 | ISC / MIT |
| @types/react / @types/react-dom | 19.3.0 | MIT |
| csstype | 3.2.3 | MIT |
| Jellyfin.Common / Jellyfin.Model (host APIs) | 12.3.0 | GPL-3.0-only |

The dependency supplement records nine upstream source trees and twelve locked npm packages, including type-only peers. Jellyfin supplies its API DLLs. They are not redistributed. General-purpose Node, .NET, build tools and FFmpeg binaries are not shipped. Build-tool versions remain pinned in the source.

Upstream binary demo/test resources and one unrelated HTTP2 demo TLS key are omitted from the supplement and listed in its source index. None is used by frame. or its runtime libraries. Original upstream source downloads are retained privately for the audit.

TMDB's attribution mark and existing non-endorsement notice are retained. TVmaze-derived details carry the existing attribution and CC BY-SA link. These terms apply to provider data, independently of the application's GPL license. The screenshots use original fictional preview content. The repository and packages contain no server media or downloaded film/show artwork.

Sources: [GPLv3](https://www.gnu.org/licenses/gpl-3.0.en.html), [GNU license FAQ](https://www.gnu.org/licenses/gpl-faq.en.html), [TMDB attribution requirements](https://developer.themoviedb.org/docs/faq), [TVmaze API licensing](https://www.tvmaze.com/api).
