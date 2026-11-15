# Changelog

## 1.0.8.0

- Discover music libraries using Jellyfin permissions and library names. Browse standalone songs, including files without artist or album metadata.
- Add a persistent audio player, queue, Play Next, album/playlist playback, seeking, volume, shuffle and repeat. Coordinate audio and video playback and use the authenticated media relay.
- Keep the music landing page focused on its song list; place music shortcuts beside Genres. Keep the player stable during seeking and buffering.
- Use Jellyfin library names in navigation, headings, shortcuts and back links. Retain empty accessible libraries and hide unavailable ones.
- Improve subtitle text contrast, font controls and responsive spacing. Align Save Font hover styles across settings and keep saved font names reusable.
- Prevent clipped text, reduce layout-editor background blur and right-align custom title tags beneath the overview.
- Make connection, artwork saving and playback presentation transitions explicit, rejecting stale completions and duplicate operations.

## 1.0.7.0

- Enable Jellyfin's normal automatic plugin updates for public Frame packages. Updates download and install through the Update Plugins scheduled task; restarting Jellyfin activates them.
- Keep Internal Diagnostics builds excluded from automatic updates.

## 1.0.6.0

- Automatically look up missing metadata and posters through saved provider IDs, using Jellyfin’s exact-match search. Keep existing metadata and artwork; do not apply library edits automatically.
- Refine playback settings, subtitle controls, quality labels and control spacing.
- Fix installed-font rendering and add a separate custom subtitle font setting.
- Recheck current image tags and provider IDs when refreshing artwork, retry failed images, and shorten caching of missing backdrops.
- Find missing artwork through verified provider IDs, including IMDb-only titles. Use TVmaze banner and poster backups for matched shows, and retry alternate images when a URL fails.
- Replace the playback spinner with a compact loading indicator, align page and panel transitions, and keep the seek-bar focus outline for keyboard input.
- Add tag management in Settings. Keep unassigned tags available after refresh; removing a title's tag does not delete the tag.
- Highlight assigned tags and make existing tags reusable from Manage Title.
- Add ticket-style Watch and Resume buttons with episode labels and a half-second pause after the tear animation.
- Replace disconnected demo pages with a connection screen and preserve saved sign-in details.
- Adjust title actions, sidebar spacing, collection footers and interface wording.
- Add a practical local development and release guide.

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
