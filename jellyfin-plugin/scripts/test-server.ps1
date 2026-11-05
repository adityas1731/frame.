param([ValidateSet('Start','Stop')][string]$Action='Start')
$ErrorActionPreference='Stop'
$frameRoot = Split-Path $PSScriptRoot -Parent
$frameTestRoot = Join-Path $frameRoot '.test-instance'
$frameServerRoot = Join-Path $frameRoot '.toolchain\jellyfin-12.3\jellyfin'
if ($Action -eq 'Stop') {
  $frameProcessId = [int](Get-Content -LiteralPath (Join-Path $frameTestRoot 'server.pid'))
  $frameServerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$frameProcessId"
  if ($frameServerProcess -and $frameServerProcess.CommandLine.Contains($frameTestRoot) -and $frameServerProcess.ExecutablePath -eq (Join-Path $frameServerRoot 'jellyfin.exe')) { Stop-Process -Id $frameProcessId; Wait-Process -Id $frameProcessId -Timeout 15 -ErrorAction SilentlyContinue; for($n=0;$n -lt 30 -and (Get-NetTCPConnection -LocalPort 18096 -State Listen -ErrorAction SilentlyContinue);$n++){Start-Sleep -Milliseconds 200}; Write-Output 'Stopped only the disposable Frame test server.' }
  elseif ($frameServerProcess) { throw 'PID no longer belongs to the disposable server; no process stopped.' }
  return
}
if (Get-NetTCPConnection -LocalPort 18096 -State Listen -ErrorAction SilentlyContinue) { throw 'Port18096 already in use; no server started.' }
$frameServerProcess = Start-Process -FilePath (Join-Path $frameServerRoot 'jellyfin.exe') -ArgumentList @('--datadir',(Join-Path $frameTestRoot 'data'),'--configdir',(Join-Path $frameTestRoot 'config'),'--cachedir',(Join-Path $frameTestRoot 'cache'),'--logdir',(Join-Path $frameTestRoot 'logs'),'--webdir',(Join-Path $frameServerRoot 'jellyfin-web'),'--ffmpeg',(Join-Path $frameRoot '.toolchain\ffmpeg\ffmpeg.exe'),'--nonetchange') -WorkingDirectory $frameServerRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $frameTestRoot 'server-output.log') -RedirectStandardError (Join-Path $frameTestRoot 'server-error.log') -PassThru
$frameServerProcess.Id | Set-Content -LiteralPath (Join-Path $frameTestRoot 'server.pid')
Write-Output ('Started disposable server PID '+$frameServerProcess.Id)
