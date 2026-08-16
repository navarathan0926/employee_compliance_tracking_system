$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $RootDir
$OutputZip = Join-Path (Split-Path -Parent $BackendDir) "backend-deploy.zip"
$TempDir = Join-Path $env:TEMP ("eb-deploy-" + [guid]::NewGuid().ToString())

$Include = @(
  "package.json",
  "package-lock.json",
  "dist"
)

if (Test-Path $OutputZip) {
  Remove-Item -Force $OutputZip
}

New-Item -ItemType Directory -Path $TempDir | Out-Null

try {
  Push-Location $BackendDir
  try {
    Write-Host "Installing dependencies..."
    npm ci --engine-strict=false

    Write-Host "Building NestJS (dist/)..."
    npm run build
  }
  finally {
    Pop-Location
  }

  foreach ($item in $Include) {
    $sourcePath = Join-Path $BackendDir $item
    if (-not (Test-Path $sourcePath)) {
      throw "Missing required deploy artifact: $item"
    }
    Copy-Item -Recurse -Force $sourcePath (Join-Path $TempDir $item)
  }

  # LF-only Procfile (CRLF breaks EB Procfile parsing on Linux).
  [System.IO.File]::WriteAllText(
    (Join-Path $TempDir "Procfile"),
    "web: npm run start:prod`n",
    [System.Text.UTF8Encoding]::new($false)
  )

  # Compress-Archive uses backslashes; EB Linux unzip fails with exit 1.
  # tar -a creates a ZIP with forward-slash paths (required on AL2023).
  Push-Location $TempDir
  try {
    tar -a -cf $OutputZip Procfile package.json package-lock.json dist
  }
  finally {
    Pop-Location
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $entries = [System.IO.Compression.ZipFile]::OpenRead($OutputZip).Entries
  $backslashes = @($entries | Where-Object { $_.FullName -match '\\' })
  if ($backslashes.Count -gt 0) {
    throw "Zip still contains Windows path separators ($($backslashes.Count) entries)."
  }

  $rootNames = @($entries | ForEach-Object { ($_.FullName -split '/')[0] } | Sort-Object -Unique)
  Write-Host "Created $OutputZip"
  Write-Host "Root entries: $($rootNames -join ', ')"
  Write-Host "Size: $([math]::Round((Get-Item $OutputZip).Length / 1MB, 2)) MB (no node_modules; EB runs npm install on Linux)"
}
finally {
  Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}
