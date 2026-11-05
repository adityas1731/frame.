# Install frame.

Requires Jellyfin Server 12.3 and server administrator access. Windows and disposable Jellyfin 12.3 installations were tested. Other server versions are not verified.

## Plugin Catalog

The catalog is not published yet. These steps apply once the release and catalog are available.

1. Back up Jellyfin's data, configuration and installed plugins. Stop all playing or paused sessions before the installation restart.
2. Open Jellyfin's **Dashboard → Plugins → Repositories**. Add a repository named `frame.` with this URL:

   ```text
   https://raw.githubusercontent.com/adityas1731/frame./plugin-catalog/manifest.json
   ```

3. Open **Catalog**, select **Frame**, choose a version compatible with your Jellyfin server and install it. The catalog entry is named Frame even though the client branding is frame.
4. Restart Jellyfin normally. Check that Frame appears under installed plugins.
5. Open your server address followed by `/Frame/Web/` and sign in normally. Include Jellyfin's BaseUrl before that path if configured. For example, a BaseUrl of `/jellyfin` uses `/jellyfin/Frame/Web/`.

The catalog points to published GitHub Release files. It does not install source archives or CI builds.

## Manual Installation

1. Download `frame-jellyfin-1.0.3.0-release-98d16e024c68.zip` and `SHA256SUMS` from release `v1.0.3`. Check the ZIP's SHA-256 against that file. Do not install a source archive or Internal Diagnostics build.
2. Back up Jellyfin and the installed plugin. Stop all playing or paused sessions, then stop the server normally.
3. Find your installation's `plugins` directory. Extract the complete ZIP into `plugins/Frame_1.0.3.0/`, with `Frame.Jellyfin.dll` directly inside. Move the previous Frame version outside `plugins` and keep it for rollback. Leave other plugins and their configuration alone.
4. Start Jellyfin and check the installed plugin list. Open `/Frame/Web/` as described above.

Windows tray installations normally use `%ProgramData%\Jellyfin\Server\plugins`. Direct Windows installs normally use `%LocalAppData%\jellyfin\plugins`. Packaged Linux installs commonly use `/var/lib/jellyfin/plugins`. Containers use the plugin directory in their mounted configuration. Custom installations may use another location. See [Jellyfin's plugin guide](https://jellyfin.org/docs/general/server/plugins/).

Use **Stop Server** and **Start Server** from the Windows tray menu for tray installations. On other systems, use the server's normal service or container controls.

## Updates And Rollback

Keep the catalog repository configured so Jellyfin can discover compatible updates. Install an offered update through Jellyfin's plugin controls, then restart when requested. If Jellyfin's plugin-update task installs an update, it still needs a restart to load. GitHub source pushes do not update installed clients.

Before updating, retain a backup and the previous plugin package. For manual updates, repeat the manual installation steps with the new version's directory and checksum.

If frame. fails after an update, stop Jellyfin. Move the new Frame directory outside `plugins`, restore only the previous compatible Frame directory and restart. Do not leave both versions installed or restore unrelated Jellyfin databases for a plugin-only rollback.

To uninstall, use Jellyfin's installed-plugin controls and restart, or stop the server and move Frame's directory out of `plugins`. The original Jellyfin Web interface remains at `/web/`.

## Troubleshooting

Check `/web/` first if the server cannot be reached. On another device use the server's reachable hostname or address, not localhost. Playback may need a compatible browser or server transcoding. Skip Intro/Credits needs file-specific server timings. Never share credentials or credential-bearing URLs in reports.
