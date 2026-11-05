# Build

Use the Node and .NET versions pinned in `frame.json` and `global.json`. Restore the locked npm and NuGet dependencies. No original application or proprietary assets are needed.

```powershell
Set-Location ui-preview
npm ci --ignore-scripts
Set-Location ..
node scripts/pipeline.mjs both
```

The pipeline checks TypeScript, frontend tests, host policies, profile isolation and plugin resources. Build outputs stay in ignored directories and are not published automatically. Public CI uploads no Internal Diagnostics builds or operational reports.

For frontend editing, run `npm run dev` inside `ui-preview`. This is separate from using the installed plugin.

The immutable 1.0.3.0 binary was built from the original revision recorded in the source mapping. Public rebuilds use their current checkout identity and updated distribution documentation. They are not relabeled as the historical binary. See RELEASE-SOURCE.md.

On Windows, clone into an explicit local directory such as `frame` because directory names ending in a dot are not portable. The requested GitHub repository name remains `frame.`.
