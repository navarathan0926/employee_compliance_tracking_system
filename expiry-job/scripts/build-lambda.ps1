$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BuildDir = Join-Path $RootDir "build\lambda"
$OutputZip = Join-Path $RootDir "build\expiry-job-lambda.zip"

if (Test-Path (Join-Path $RootDir "build")) {
  Remove-Item -Recurse -Force (Join-Path $RootDir "build")
}

New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

python -m pip install -r (Join-Path $RootDir "requirements.txt") -t $BuildDir --upgrade
Copy-Item -Recurse -Force (Join-Path $RootDir "src\*") $BuildDir

if (Test-Path $OutputZip) {
  Remove-Item -Force $OutputZip
}

Compress-Archive -Path (Join-Path $BuildDir "*") -DestinationPath $OutputZip

Write-Host "Created $OutputZip"
