$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BuildDir = Join-Path $RootDir "build\lambda"
$OutputZip = Join-Path $RootDir "build\expiry-job-lambda.zip"
$RequirementsLambda = Join-Path $RootDir "requirements-lambda.txt"

if (Test-Path (Join-Path $RootDir "build")) {
  Remove-Item -Recurse -Force (Join-Path $RootDir "build")
}

New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

try {
  Write-Host "Installing Lambda runtime dependencies (Linux x86_64 wheels)..."
  python -m pip install `
    -r $RequirementsLambda `
    -t $BuildDir `
    --upgrade `
    --no-cache-dir `
    --platform manylinux2014_x86_64 `
    --python-version 3.11 `
    --implementation cp `
    --only-binary=:all:
  if ($LASTEXITCODE -ne 0) {
    throw "pip install failed (exit $LASTEXITCODE)"
  }

  Write-Host "Copying application source (src/*.py only)..."
  Copy-Item -Force (Join-Path $RootDir "src\*.py") $BuildDir

  # Do NOT include: tests/, .env*, scripts/, pytest, __pycache__.
  Get-ChildItem -Path $BuildDir -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
  Get-ChildItem -Path $BuildDir -Recurse -Directory |
    Where-Object { $_.Name -in @("tests", "test") } |
    Remove-Item -Recurse -Force

  # tar -a creates a ZIP with forward-slash paths (required on Lambda Linux).
  Push-Location $BuildDir
  try {
    tar -a -cf $OutputZip *
  }
  finally {
    Pop-Location
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $entries = [System.IO.Compression.ZipFile]::OpenRead($OutputZip).Entries
  $backslashes = @($entries | Where-Object { $_.FullName -match '\\' })
  $badPaths = @($entries | Where-Object {
    $_.FullName -match '(^|/)\.env|(^|/)pytest|__pycache__'
  })
  if ($backslashes.Count -gt 0) {
    throw "Zip contains Windows path separators ($($backslashes.Count) entries)."
  }
  if ($badPaths.Count -gt 0) {
    throw "Zip contains excluded paths: $($badPaths[0].FullName)"
  }

  Write-Host "Created $OutputZip"
  Write-Host "Size: $([math]::Round((Get-Item $OutputZip).Length / 1MB, 2)) MB"
  Write-Host "Handler: lambda_handler.handler"
}
catch {
  Remove-Item -Recurse -Force (Join-Path $RootDir "build") -ErrorAction SilentlyContinue
  throw
}
