# Music support — local development

## Root cause

Frame discarded UserViews whose CollectionType was `music`. Its normal item query only requested Movie/Series, and its playback planner required a video stream. Jellyfin indexing was not the problem. A standalone MP3 may legitimately have no album entry; the music landing page therefore opens Songs.

## What changed

| Area | Files | Behavior |
| --- | --- | --- |
| Discovery and navigation | `src/app/libraryNavigation.ts`, `useLibraries.ts`, `Shell.tsx`, `App.tsx` | Use accessible Jellyfin views and their exact names, including multiple and empty music libraries. Music-aware search and detail routes. |
| Jellyfin data | `src/jellyfin/types.ts`, `client.ts` | Validated audio/artist/album fields; user-scoped Items, Artists, MusicGenres and playlist requests, search, sorting and pagination. |
| Browsing | `src/music/MusicPage.tsx`, `MusicArtwork.tsx`, `presentation.ts`, `music.css` | Song-list landing page without category tabs; existing artist/album/playlist detail routes; artist albums/tracks; album and playlist playback; Jellyfin artwork or a fallback. No external metadata lookup. |
| Audio runtime | `src/music/controller.ts`, `protocol.ts`, `queue.ts`, `context.tsx` | One persistent audio element, queue occurrence IDs, direct playback or progressive MP3 fallback, seek, volume, shuffle, repeat and ordered/coalesced session reports. |
| Player and Home | `src/music/MusicPlayer.tsx`, `MusicTrackCard.tsx`, `MusicWidget.tsx`, `src/studio/{model,Widgets,HomeStudio,GenreField}.tsx` | Persistent Cinema player and editable queue, mobile controls, Audio home sections and music library shortcuts. |
| Video handoff | `src/playback/mediaFocus.ts`, `runtime.ts` | Starting either player pauses the previous owner. Late asynchronous play events cannot reclaim ownership. |
| Authenticated transport | `public/frame-stream-{policy,sw}.js`, `jellyfin-plugin/src/{FrameMediaController,RelayPolicy}.cs` | Allowlisted, active-item Audio streams through the existing authenticated gateway; original video/HLS/subtitle rules retained. |
| Isolated verification | `scripts/music.test.mjs`, `scripts/fixtures/music.ts`, `public/test-media/frame-audio.mp3`, `dev/media-proxy.ts`, plugin relay tests | Fictional credentials and original silent MP3; no real listening history or files changed. Test media is excluded from release assets. |

Frontend paths above are relative to `ui-preview/` unless explicitly under `jellyfin-plugin/`.

## Playback rules

Each track has one versioned operation owning negotiation, gateway, event listeners and timeout. Replacing a track invalidates the old operation before the next starts. An old collection lookup cannot replace a newer play choice. Queue editing never restarts the current stream. Playlist duplicates remain separate occurrences.

Audio-only PlaybackInfo uses browser container and codec capability checks. Compatible files can play directly, including higher-bitrate files; fallback is progressive stereo MP3 at 192 kbps when the server permits transcoding. Direct failures receive one transcode attempt. Seek in a transcode opens a new session at the requested offset. A stalled startup/buffer becomes a retryable error after 45 seconds.

Started/progress/stopped reports use Jellyfin's session APIs. Progress writes are coalesced and ordered; a stopped operation cannot report subsequent progress. Logout, connection loss and page exit close the audio session and release its grant. Optional Media Session controls follow the current media owner, including while music is paused.

## Validation

- 551 frontend release-mode tests pass, including 28 music regressions; existing video, subtitle and HLS coverage remains green.
- TypeScript, release build and release-asset verification pass. No diagnostics or fixture MP3 in release assets.
- Plugin build against the local release frontend succeeds with zero warnings/errors; host and relay policy tests pass.
- Browser: original synthetic MP3 streamed through the actual HTMLAudioElement and service worker; progress advanced; playback continued across albums, artists and movie-library pages. Verified queue order, natural next, album playback, seek, pause, shuffle/repeat, search, empty/permission-hidden libraries, Home integration and 390px phone layout/volume controls. Fresh mount had no console warnings/errors.
- Logs: `.local/music-{focused-tests,final-validation,relay-tests,plugin-build}.log`.

The host harness and synthetic browser fixture do not prove a deployed Jellyfin audio relay or every browser codec. No installed server was restarted or updated.

## Local acceptance

Open **http://127.0.0.1:5173/** and use the existing authorized development connection. The test browser had no remembered Legion session, so real-server acceptance remains manual:

1. Open the server-named music library → Songs. Confirm the existing MP3 appears despite missing artist/album data; Albums may be empty.
2. Play it, seek, pause/resume and navigate to another section. Audio should continue. Stop it when finished; real playback updates your Jellyfin history.
3. Add tracks to the queue, use Play Next, reorder/remove and try shuffle/repeat. Play an album or an accessible audio playlist if available.
4. Start a movie/episode, then resume music. Only the latest player should be audible. Check subtitles and normal video controls.
5. If your browser exposes system media controls, check play/pause and next there. Browser support varies.

## Limits

- Queue is kept in memory while navigating, not after reload, logout or connection loss; maximum 5,000 entries.
- Playback is not gapless; no crossfade, downloads, lyrics, playlist editing or external metadata providers.
- Playlist browsing preserves server order; its search filters the current page. Play all searches the collected playlist, bounded by the queue limit.
- Album/artist availability depends on Jellyfin metadata. Missing artwork uses an icon; metadata is never invented.
- Publishing the package does not update an installed server until Jellyfin installs it and restarts.

## Local UI follow-up

Music library shortcuts sit immediately before Genres in the Your Library toolbar. The music landing page shows the song list directly, without Songs/Albums/Artists/Playlists tabs. Existing detail routes and playback support remain available.

Pointer scrubbing previews the selected time and seeks once on release; cancellation discards the preview. Live position updates cannot pull the thumb back during a drag. Loading/buffering messages use the existing artist line, so the dock retains its normal dimensions. Pointer focus no longer draws an accent rectangle around the range; keyboard focus is shown on the thumb.

Verified with a native browser drag and a forced synthetic buffering event: dock height stayed 100.64px and its top stayed 605.36px on the desktop fixture. All 551 release-mode tests, typecheck, release build and verification passed again (`.local/music-seek-validation.log`).
