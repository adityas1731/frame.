param([Parameter(Mandatory)][string]$Draft,[Parameter(Mandatory)][string]$Version)
$ErrorActionPreference='Stop'
if($env:GITHUB_REPOSITORY -cne 'adityas1731/frame.' -or $Draft -notmatch '^\d+$' -or $Version -notmatch '^\d+\.\d+\.\d+\.\d+$'){throw 'Unexpected distribution selection'}
$receipt=Get-Content -Raw -LiteralPath ('release/'+$Version+'.json')|ConvertFrom-Json
$release=gh api ('repos/adityas1731/frame./releases/'+$Draft)|ConvertFrom-Json
if($LASTEXITCODE -ne 0 -or !$release.draft -or $release.tag_name -cne $receipt.tag){throw 'Matching unpublished draft required'}
New-Item -ItemType Directory -Path .local/release-input -ErrorAction Stop|Out-Null
$arguments=@('release','download',$receipt.tag,'--repo','adityas1731/frame.','--dir','.local/release-input')
foreach($asset in $receipt.assets){if([IO.Path]::GetFileName($asset.name) -cne $asset.name){throw 'Unsafe asset name'};$arguments+=@('--pattern',$asset.name)}
& gh @arguments
if($LASTEXITCODE -ne 0){throw 'Draft download failed'}
