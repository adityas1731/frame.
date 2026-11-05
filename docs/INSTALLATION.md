# Install frame.

Requires Jellyfin Server 12.3 and administrator access to its plugin directory. Windows and disposable Jellyfin 12.3 installations were tested. Other server versions are not verified.

1. Download the Release plugin ZIP and `SHA256SUMS`. Do not install the source archive or an Internal build.
2. Back up Jellyfin data/configuration and the installed plugin. Stop all playing or paused sessions, then stop Jellyfin normally.
3. Extract the ZIP into `plugins/Frame_1.0.3.0/`. The DLL belongs directly in that folder. Move an older frame. directory outside `plugins` and retain it. Leave other plugins alone.
4. Restart Jellyfin. Check Dashboard â†’ Plugins for Frame. Open your server address followed by `/Frame/Web/` and sign in normally. Include Jellyfin's BaseUrl before the path if configured.

On Windows tray installations, use Stop Server and Start Server from the tray menu. Containers use the plugin directory in their mounted configuration. See [Jellyfin's plugin guide](https://jellyfin.org/docs/general/server/plugins/).

## Catalog

After publication, add the approved manifest URL under Dashboard â†’ Plugins â†’ Repositories. Install Frame from Catalog, then restart. The intended URL is `https://raw.githubusercontent.com/adityas1731/frame./plugin-catalog/manifest.json`. It is not live during preparation.

## Update Or Remove

Back up and stop the server first. Keep the previous plugin outside `plugins`. If an update fails, stop Jellyfin, move the new directory out, restore the previous directory and restart. Do not restore unrelated databases for a plugin-only rollback.

To uninstall, stop Jellyfin and remove the frame. plugin directory. The original Jellyfin Web interface remains at `/web/`.

## Troubleshooting

Check `/web/` first if the server cannot be reached. On another device use the server's reachable hostname/address, not localhost. Playback failures may need a compatible browser or server transcoding. Skip Intro/Credits needs file-specific server timings. Never share credentials or credential-bearing URLs in reports.
