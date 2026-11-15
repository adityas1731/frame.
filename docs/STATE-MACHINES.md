# App state machines

Source review of the current local UI batch, 15 November 2026. This records the source review and the subsequent local refactor. Connection ownership, artwork saving and playback presentation now have explicit state models. Other entries remain inferred from existing flags and callbacks. No state-machine dependency was added.

## Implemented locally

| Production state model | States | Transition guarantees |
| --- | --- | --- |
| `ui-preview/src/jellyfin/connectionMachine.ts` | signed-out / connecting / restoring / connected / unavailable | One operation owns pending authentication. Replaced or cancelled clients cannot activate or persist credentials. Disconnect clears local state immediately; late logout errors cannot overwrite a newer session. A replacement-server probe preserves the previous server's offline status. |
| `ui-preview/src/playback/presentationMachine.ts` | controls / hidden / pause, with exactly one panel: none / settings / episodes | Media phase drives presentation. Versioned idle events cannot close a newly opened panel or show a stale pause screen. Keyboard focus keeps controls available. Episode browsing resumes only the same paused playback session; leaving is terminal. |
| `ui-preview/src/components/artworkSaveMachine.ts` | idle / preparing / saving / settling / saved / failed / uncertain | Synchronous ownership prevents duplicate clicks before React renders. Title, account, provider identity and artwork kind scope each picker; layout cleanup invalidates its operation. Each awaited stage checks ownership before the next step. Unconfirmed shared writes block another save until an artwork refresh. |

`ConnectionContext.tsx`, `Player.tsx` and `BannerPicker.tsx` consume these models directly. Their existing public UI, classes and controls remain in place. Connection activation now reports whether the pending client was accepted, and Connect cancels its pending client when leaving the form. Playback is also keyed by account, server and title.

The streaming negotiation/transport runtime was retained. This change makes playback **presentation** explicit around its existing phase model; it does not replace the HLS, media-element or reporting implementation. A save already submitted to Jellyfin cannot be recalled on navigation. Cancellation stops its subsequent local cleanup and UI feedback from affecting a new owner.

## Inventory

| Flow and owner | States and transitions | Guards / important boundaries |
| --- | --- | --- |
| Connection restoration — `ui-preview/src/jellyfin/ConnectionContext.tsx`, `jellyfin/connectionMachine.ts` **explicit** | Signed out → restoring saved session → connected; failed transport → unavailable with saved session; rejected credentials → signed out. Reconnect restarts restoration; disconnect cancels it. | Generation counter and disposed pending clients reject stale restoration results. An unreachable server must not erase remembered credentials. |
| Connection routing — `components/ConnectionGate.tsx` | Connected content / connection form / unavailable page. | Derived from session, saved session and unavailable flag. No demo-library fallback. This is a separate UI machine from authentication. |
| Remote reads — `jellyfin/hooks.ts` | Initial loading → data or error; reload → refresh with retained data; changed key → fresh loading; permission/not-found error → clear data. | Effect cleanup discards late responses. Client, account and item identity belong in keys. Retry invalidates the client cache; revalidate does not. |
| Library resolution — `app/useLibraries.ts`, `app/libraryNavigation.ts`, `pages/LiveDetail.tsx` | Discover accessible views → resolve requested view or title ancestors → server-named destination; unresolved ancestry → aggregate library destination. | Only accessible view IDs supply labels. Collection type selects route, never the display name. Empty libraries remain available. A rename is reflected after server reload. |
| Watch action — `playback/WatchButton.tsx` | Idle → resolving target + ticket animation concurrently → waiting for both → playback route; failure → retryable idle. Restart bypasses ticket delay. | Busy blocks repeated clicks; unmount blocks delayed navigation. Series stub and playback target must refer to the same resolved episode. |
| Ticket visual — `components/TicketButton.tsx` | Resting → torn → reset, with reduced-motion bypass. | Visual state is separate from playback readiness. Animation completion does not mean media has started. |
| Playback lifecycle — `playback/foundation.ts` **explicit**, `playback/runtime.ts` production owner | Idle → negotiating → ready → playing / paused / buffering / seeking; track/quality change → switching → ready; terminal ended / failed / disposed. | Foundation exports a pure transition model; runtime separately drives the actual media lifecycle. Generation invalidates replaced sources, reports are serialized, cleanup is idempotent. The two implementations should be kept behaviorally aligned. |
| Playback presentation — `playback/Player.tsx`, `playback/presentationMachine.ts` **explicit** | Entry choice → active player; playing with controls visible → idle controls hidden; paused → idle pause screen; settings and episode browser temporarily hold controls open; ended → completion screen. | This is orthogonal to playback phase. A paused idle screen must never imply ended. Keyboard focus and pointer activity affect visibility; do not remove keyboard focus just to hide controls. |
| Track changes / subtitles — `playback/runtime.ts`, `playback/PlayerSettings.tsx` | Current track → switching → selected track or failure; server text / server-rendered / custom / additional subtitles are alternative selection states. | Keep position across renegotiation. Server-rendered subtitles cannot use client-side font styling. UI readiness must follow plan/phase, not the selected tab. |
| Subtitle upload — `jellyfin/client.ts`, `playback/SaveSubtitleControls.tsx` | Temporary loaded subtitle → review/save → uploading → saved, rejected, or uncertain outcome. | Fresh permissions and media-version checks precede upload; per-item upload lock prevents overlap. Ambiguous network failures must not invite blind duplicate uploads. |
| Artwork discovery — `components/BannerPicker.tsx` | Closed → loading alternatives → available / empty / failed; changing title, provider identity or refresh revision restarts discovery. | Effect cleanup rejects stale gallery results. Banner and poster pools remain separate; dimension limits govern selectable images. |
| Artwork mutation — `components/BannerPicker.tsx`, `components/artworkSaveMachine.ts` **explicit** | Idle → preparing → saving local or shared artwork → saved or error; automatic artwork clears the override. | Local selection, uploaded artwork and Jellyfin artwork are distinct stores. Shared mutation requires server permission. Busy disables the affected controls without tinting the gallery. |
| Artwork display recovery — `components/ServerArtwork.tsx`, `components/EpisodeArtwork.tsx` | Preferred image → loading → decoded image; failure → next candidate; exhausted → fallback; revision or bounded recovery reopens candidates. | Object URLs are released; failures are tied to image identity. A failed request must not permanently suppress later valid artwork. |
| Provider metadata — `providers/hooks.ts` | Disabled / unresolved → enriching → available / absent / failed → bounded episode-artwork recovery. | Client + metadata identity guard stale display results; attempts reset on identity changes. Enrichment does not overwrite the server DTO. |
| Identification — `components/IdentifyMedia.tsx` | Query → searching → matches → selected match → confirmed → applying → complete; apply error → uncertain. | Administrator only. Confirmation resets when selecting a different match. An uncertain write cannot be reapplied blindly; refresh first. |
| Installed fonts — `appearance/fonts.ts`, `studio/InstalledFontField.tsx` | Empty / invalid → debounce → resolving local face → available / unavailable / unknown. Save-name state is separate from availability. | Local loading times out at 1.5 seconds; unknown is not reported as missing. Stale input results are ignored. Saved rows do not launch independent availability probes. |
| Select menu — `components/Select.tsx` | Closed → open with active option → keyboard/pointer movement → commit or dismiss. | Active option differs from selected value. Disabled options cannot commit. Escape/outside click/blur close; scrolling repositions. |
| Live layout editor — `components/CollectionLayout.tsx`, `state/collectionLayout.ts` | Closed ↔ editing; each change → normalized value → persistent save or session-only error. Reset is another edit; Done closes. | There is no pending draft or commit step: changes save immediately. Backdrop must leave the edited collection visible. |
| Tags — `state/TitleTags.tsx` | Named tag with zero or more memberships; add/remove membership; rename merges normalized names; delete removes the tag globally. | Tag existence and membership are separate state. Removing the last membership must preserve the tag name. Scoped storage failure must remain visible. |

## Remaining boundaries

- Foundation's pure playback model and the production transport runtime remain separate. Keep their behavior aligned when changing media negotiation or reports.
- Identification and subtitle uploads retain their existing uncertain-write handling. Do not add automatic write retries when centralizing those flows.
- Metadata lookup must continue to distinguish pending, no match, transport failure and match without artwork. External provider availability cannot be guaranteed.
- Artwork gallery discovery and provider refresh remain separate from the save machine. They must not reset an active save or manufacture a successful save result.

## Useful regression scenarios

- Restore A, then disconnect or connect B before A responds: A must never become active again.
- Resolve a library name, rename it in Jellyfin, then reload: navigation, heading and back destination change together. An inaccessible ancestor never supplies a label.
- Click Resume twice, then leave the detail page during the tear: at most one route transition, none after unmount.
- Pause and wait six seconds: show pause information, not episode finished. Resume and let controls idle: hide them unless keyboard interaction or an open panel needs them.
- Switch source/track while a previous negotiation is pending: only the newest generation owns playback; each old play session receives at most one stopped report.
- Open artwork, switch title while images load, then refresh: the gallery must contain only the current title and artwork kind.
- Time out a shared artwork or metadata write: do not treat an unconfirmed write as proof nothing changed.
- Enter an unavailable font, then a valid font before resolution: only the current name controls status; timeout must not leave a permanent checking label.
- Remove a tag's final title, refresh, and add it again: tag still exists.
- Edit layout with a wide font and large UI text: edited content remains visible; tabs and text stay inside their borders.

## Validation for this batch

523 release-mode tests passed, including 25 new state-machine tests using controlled pending promises and a cross-product of playback phases, panels and idle events. They cover replaced restores, sign-out during authentication, stale logout/revocation, remembering without storage, unavailable-server replacement, duplicate artwork clicks, cancellation at each async boundary, partial/uncertain shared writes, timer invalidation, keyboard focus and episode-session ownership. Existing playback-runtime, subtitles, metadata, artwork, font and navigation tests also pass.

StrictMode browser fixtures mount the actual ConnectionProvider, Player and ArtworkPicker with memory-only credentials and synthetic services. Verified: rejected late sign-in; old logout failure after a new sign-in; reconnect; offline replacement probe; controls hiding after playback idle; six-second paused screen; resume; completion and replay; settings staying open; old artwork completion after changing title; successful save and uncertainty blocking. Fresh mounts had no console errors. No media was played or real Jellyfin credentials used in these fixtures.

TypeScript, the release build and release artifact verification passed. Release assets contain no diagnostics. No production installation or publication was performed. These checks cannot prove every browser, transport failure or external provider response.


## Music playback and media ownership

The local music implementation adds a persistent `MusicController`: idle → negotiating → ready → playing/paused/buffering → ended/failed. Each queue occurrence has its own key; each open operation has a generation and abort signal. Replaced negotiations, stale collection loads and old native events cannot restart a superseded track. Direct failures have a single MP3 fallback; stalled startup/buffering has a bounded timeout. Reports are serialized with progress coalescing and one stopped event per started operation.

`MediaFocus` is the shared audio/video owner. A new claim interrupts the old owner before playback. Paused music keeps optional system controls until another player claims ownership; stale playing events must also match the operation's play intent. Route navigation does not recreate the controller. See [MUSIC.md](MUSIC.md) for validation and limits.
