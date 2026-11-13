# Changelog

## 1.0.5.0

- List all available subtitle tracks, including languages outside the audio shortlist.
- Load local SRT/VTT files or direct HTTPS subtitle links. Save validated subtitles to Jellyfin with explicit confirmation and server permission checks.
- Keep saved banner artwork ahead of automatic provider fallbacks. Add shared artwork saving and a banner-selection grid.
- Unify collection layout controls and refine navigation, pause screens, custom fonts and card hover states.
- Remove the automatic demo library and simplify the connection page.
- Fix the player viewport gap and empty Watchlist loading state.

## 1.0.4.0

- Fix relay HTTP 502 failures for valid HLS playlists larger than 1 MB.
- Allow playlists up to 8 MiB, with the same item, origin and authentication checks.
- Add long-playlist and UTF-8 size-limit regression coverage.

## 1.0.3.0

- Fingerprint committed source independently of checkout line endings.
- Update installation documentation and include real demo screenshots.
- No intentional playback or interface changes from the preceding maintenance candidate.

The release binary and matching source archives are fixed. Later publication and documentation commits do not replace them. Private development releases and operational reports are not included in this repository.
