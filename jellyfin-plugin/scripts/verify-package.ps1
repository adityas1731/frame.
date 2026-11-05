param([Parameter(Mandatory)][string]$Archive,[ValidateSet('release','diagnostics')][string]$Profile='release',[string]$ExpectedSha256='', [string]$ExpectedVersion='', [string]$ExpectedCommit='')
$ErrorActionPreference='Stop'
$frameActualHash=(Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
if($ExpectedSha256 -and $frameActualHash -ne $ExpectedSha256.ToLowerInvariant()){throw 'Approved archive checksum mismatch'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$frameZip=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Archive))
try {
 $frameFiles=@{}
 foreach($frameEntry in $frameZip.Entries){
  $frameName=$frameEntry.FullName
  if($frameName -notin @('Frame.Jellyfin.dll','meta.json','FRAME-PACKAGE.json','THIRD-PARTY-NOTICES.md','licenses/Jellyfin.Common-GPL-3.0.html','LICENSE','SOURCE.md') -or $frameFiles.ContainsKey($frameName)){throw 'Unexpected or duplicate package file'}
  if($frameEntry.Length -gt 20000000){throw 'Unexpected package size'}
  $frameStream=$frameEntry.Open();$frameBuffer=[System.IO.MemoryStream]::new();try{$frameStream.CopyTo($frameBuffer);$frameFiles[$frameName]=$frameBuffer.ToArray()}finally{$frameStream.Dispose();$frameBuffer.Dispose()}
 }
 if($frameFiles.Count -notin @(5,7)){throw 'Missing package file'}
 $frameManifest=[Text.Encoding]::UTF8.GetString($frameFiles['FRAME-PACKAGE.json'])|ConvertFrom-Json
 if($ExpectedCommit -and ($frameManifest.sourceCommit -cne $ExpectedCommit -or $frameManifest.sourceDirty)){throw 'Source revision mismatch'}
 $frameMeta=[Text.Encoding]::UTF8.GetString($frameFiles['meta.json'])|ConvertFrom-Json
 if([version]$frameMeta.version -ge [version]'1.0.1.0' -and (!$frameFiles.ContainsKey('LICENSE') -or !$frameFiles.ContainsKey('SOURCE.md'))){throw 'Missing public distribution license or source instructions'}
 if($frameManifest.format -ne 'frame-plugin-v1' -or $frameManifest.profile -ne $Profile -or $frameManifest.version -ne $frameMeta.version -or $frameMeta.targetAbi -ne '12.3.0.0' -or $frameMeta.guid -ne '1c38ef02-2393-4f54-a18b-fcfcbf394d65'){throw 'Plugin manifest mismatch'}
 if(-not $ExpectedVersion){$ExpectedVersion=if($Profile -eq 'release'){'0.1.0.0'}else{'0.1.0.1'}}
 if($frameMeta.version -ne $ExpectedVersion){throw 'Profile version mismatch'}
 foreach($frameProperty in $frameManifest.files.PSObject.Properties){if(-not $frameFiles.ContainsKey($frameProperty.Name)){throw 'Manifest file missing'};$frameHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($frameFiles[$frameProperty.Name])).ToLowerInvariant();if($frameHash -ne $frameProperty.Value){throw 'Packaged file hash mismatch'}}
 if($frameManifest.files.PSObject.Properties.Name.Count -ne ($frameFiles.Count-1)){throw 'Incomplete file integrity manifest'}
 if($frameManifest.assemblySha256 -ne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($frameFiles['Frame.Jellyfin.dll'])).ToLowerInvariant()){throw 'Assembly hash mismatch'}
 [pscustomobject]@{format='frame-zip-verification-v1';profile=$Profile;version=$frameMeta.version;sha256=$frameActualHash;files=$frameFiles.Count;sourceFingerprint=$frameManifest.sourceFingerprint} | ConvertTo-Json
} finally {$frameZip.Dispose()}
