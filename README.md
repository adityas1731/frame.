# frame.

A customizable browser client for Jellyfin, installed as a server plugin. Open `/Frame/Web/` on your Jellyfin server. The original `/web/` interface stays available.

Tested with Jellyfin Server 12.3. Supports movies and series, browser playback, resume, audio/subtitle controls, favorites, a local watchlist and home-layout customization. Skip buttons require valid timings supplied by Jellyfin for the current file.

![frame. home](docs/images/home-demo.jpg)

## Install

Install **Frame** from its Jellyfin plugin catalog, or extract the Release ZIP into the server's plugin directory. Back up first and restart Jellyfin after installation. Open `/Frame/Web/` and sign in with your Jellyfin account. Installed plugins do not need `npm run dev`.

[Installation, updates and rollback](docs/INSTALLATION.md). The repository and draft release are currently private. The catalog is not available yet.

## Limits

Playback depends on browser codecs, server transcoding and account permissions. Physical iPhone/Safari coverage is incomplete. This plugin does not change Swiftfin or other native clients. It does not identify every file correctly or detect intros itself.

## Source

[Build instructions](docs/BUILDING.md) | [Release/source mapping](docs/RELEASE-SOURCE.md) | [Licensing](docs/LICENSING.md)

Original code is GPL-3.0-only. Matching source and dependency-source archives accompany the release binary. Third-party notices remain applicable.
