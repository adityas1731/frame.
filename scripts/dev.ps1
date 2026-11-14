param([ValidateSet('preview','check','package')][string]$Action='preview')
$ErrorActionPreference='Stop'
$frameRoot=Split-Path $PSScriptRoot -Parent
Push-Location $frameRoot
try {
  $frameConfig=Get-Content -LiteralPath 'frame.json' -Raw|ConvertFrom-Json
  if((node --version) -cne ('v'+$frameConfig.node)){throw "Use Node $($frameConfig.node), as pinned in frame.json."}
  switch($Action){
    'preview' {
      # Vite's existing --strictPort guard refuses an occupied 5173 without
      # requiring CIM access, stopping processes or choosing a different port.
      Write-Host 'Preview: http://127.0.0.1:5173/ . If it is already running, reuse that page.'
      Push-Location 'ui-preview'
      try { & npm.cmd run dev; if($LASTEXITCODE -ne 0){throw 'Preview exited with an error.'} } finally {Pop-Location}
    }
    'check' {
      Push-Location 'ui-preview'
      try {
        & npm.cmd run typecheck; if($LASTEXITCODE -ne 0){throw 'TypeScript failed.'}
        & npm.cmd test; if($LASTEXITCODE -ne 0){throw 'Frontend tests failed.'}
      } finally {Pop-Location}
    }
    'package' {
      if(git status --porcelain){throw 'Commit the reviewed changes before packaging. Keep generated artifacts ignored.'}
      & node scripts/pipeline.mjs both
      if($LASTEXITCODE -ne 0){throw 'Package validation failed. Do not install or publish these outputs.'}
      Write-Host 'Both profiles passed. Release ZIPs are in jellyfin-plugin/artifacts. Nothing was uploaded or installed.'
    }
  }
} finally {Pop-Location}
