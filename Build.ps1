[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Manifest = Get-Content -LiteralPath (Join-Path $ProjectRoot 'manifest.json') -Raw | ConvertFrom-Json
$Version = $Manifest.version
$BuildRoot = Join-Path $ProjectRoot 'build'
$Stage = Join-Path $BuildRoot 'Nexus Library Importer'
$FirefoxStage = Join-Path $BuildRoot 'Nexus Library Importer Firefox'
$KitStage = Join-Path $BuildRoot 'Web Store Submission Kit'
$ReleaseRoot = Join-Path $ProjectRoot 'Releases'
$ChromeArchive = Join-Path $ReleaseRoot "Nexus-Library-Importer-$Version-Chrome.zip"
$OperaArchive = Join-Path $ReleaseRoot "Nexus-Library-Importer-$Version-Opera.zip"
$FirefoxArchive = Join-Path $ReleaseRoot "Nexus-Library-Importer-$Version-Firefox.zip"
$KitArchive = Join-Path $ReleaseRoot "Nexus-Library-Importer-$Version-Web-Store-Kit.zip"
$LegacyArchive = Join-Path $ReleaseRoot "Nexus-Steam-Importer-$Version.zip"
$LegacyDirectory = Join-Path $ReleaseRoot "Nexus-Steam-Importer-$Version"
$PreviousChromeArchive = Join-Path $ReleaseRoot "Nexus-Steam-Library-Importer-$Version-Chrome.zip"
$PreviousOperaArchive = Join-Path $ReleaseRoot "Nexus-Steam-Library-Importer-$Version-Opera.zip"
$PreviousKitArchive = Join-Path $ReleaseRoot "Nexus-Steam-Library-Importer-$Version-Web-Store-Kit.zip"
$Checksums = Join-Path $ReleaseRoot 'SHA256SUMS.txt'

Push-Location $ProjectRoot
try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }

    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'Syntax checks failed.' }
}
finally {
    Pop-Location
}

foreach ($Directory in @($Stage, $FirefoxStage, $KitStage)) {
    if (Test-Path -LiteralPath $Directory) {
        Remove-Item -LiteralPath $Directory -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
}
New-Item -ItemType Directory -Path $ReleaseRoot -Force | Out-Null

$RuntimeFiles = @(
    'manifest.json',
    'background.js',
    'content.js',
    'gog-library.js',
    'matcher.js',
    'nexus-worker.js',
    'steam-library.js',
    'styles.css'
)

foreach ($File in $RuntimeFiles) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot $File) -Destination (Join-Path $Stage $File)
}
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'icons') -Destination (Join-Path $Stage 'icons') -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'provider-icons') -Destination (Join-Path $Stage 'provider-icons') -Recurse
Copy-Item -Path (Join-Path $Stage '*') -Destination $FirefoxStage -Recurse -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'manifest.firefox.json') -Destination (Join-Path $FirefoxStage 'manifest.json') -Force

foreach ($Archive in @($ChromeArchive, $OperaArchive, $FirefoxArchive, $KitArchive, $LegacyArchive, $PreviousChromeArchive, $PreviousOperaArchive, $PreviousKitArchive)) {
    if (Test-Path -LiteralPath $Archive) {
        Remove-Item -LiteralPath $Archive -Force
    }
}
if (Test-Path -LiteralPath $LegacyDirectory) {
    Remove-Item -LiteralPath $LegacyDirectory -Recurse -Force
}

Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $ChromeArchive -CompressionLevel Optimal
Copy-Item -LiteralPath $ChromeArchive -Destination $OperaArchive
Compress-Archive -Path (Join-Path $FirefoxStage '*') -DestinationPath $FirefoxArchive -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$Zip = [System.IO.Compression.ZipFile]::OpenRead($ChromeArchive)
try {
    $EntryNames = @($Zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($Required in @('manifest.json', 'background.js', 'content.js', 'gog-library.js', 'icons/icon-128.png', 'provider-icons/steam.png', 'provider-icons/gog.png', 'provider-icons/ubisoft.png', 'provider-icons/ea.svg')) {
        if ($Required -notin $EntryNames) {
            throw "Production ZIP is missing $Required at the archive root."
        }
    }
    foreach ($ForbiddenPrefix in @('tests/', 'store-assets/', 'store-listing/', 'assets/')) {
        if ($EntryNames | Where-Object { $_.StartsWith($ForbiddenPrefix, [System.StringComparison]::OrdinalIgnoreCase) }) {
            throw "Production ZIP unexpectedly includes $ForbiddenPrefix."
        }
    }
}
finally {
    $Zip.Dispose()
}

$FirefoxZip = [System.IO.Compression.ZipFile]::OpenRead($FirefoxArchive)
try {
    $FirefoxEntryNames = @($FirefoxZip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($Required in @('manifest.json', 'background.js', 'matcher.js', 'content.js', 'gog-library.js', 'icons/icon-128.png', 'provider-icons/steam.png', 'provider-icons/gog.png', 'provider-icons/ubisoft.png', 'provider-icons/ea.svg')) {
        if ($Required -notin $FirefoxEntryNames) {
            throw "Firefox ZIP is missing $Required at the archive root."
        }
    }
    foreach ($ForbiddenPrefix in @('tests/', 'store-assets/', 'store-listing/', 'assets/')) {
        if ($FirefoxEntryNames | Where-Object { $_.StartsWith($ForbiddenPrefix, [System.StringComparison]::OrdinalIgnoreCase) }) {
            throw "Firefox ZIP unexpectedly includes $ForbiddenPrefix."
        }
    }
}
finally {
    $FirefoxZip.Dispose()
}

$Packages = Join-Path $KitStage 'packages'
New-Item -ItemType Directory -Path $Packages -Force | Out-Null
Copy-Item -LiteralPath $ChromeArchive -Destination $Packages
Copy-Item -LiteralPath $OperaArchive -Destination $Packages
Copy-Item -LiteralPath $FirefoxArchive -Destination $Packages
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'store-assets') -Destination (Join-Path $KitStage 'store-assets') -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'store-listing') -Destination (Join-Path $KitStage 'store-listing') -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'README.md') -Destination $KitStage
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'CHANGELOG.md') -Destination $KitStage

$ChromeHash = (Get-FileHash -LiteralPath $ChromeArchive -Algorithm SHA256).Hash
$OperaHash = (Get-FileHash -LiteralPath $OperaArchive -Algorithm SHA256).Hash
$FirefoxHash = (Get-FileHash -LiteralPath $FirefoxArchive -Algorithm SHA256).Hash
@(
    "$ChromeHash  $(Split-Path -Leaf $ChromeArchive)",
    "$OperaHash  $(Split-Path -Leaf $OperaArchive)",
    "$FirefoxHash  $(Split-Path -Leaf $FirefoxArchive)"
) | Set-Content -LiteralPath (Join-Path $KitStage 'SHA256SUMS.txt') -Encoding utf8

Compress-Archive -Path (Join-Path $KitStage '*') -DestinationPath $KitArchive -CompressionLevel Optimal
$KitHash = (Get-FileHash -LiteralPath $KitArchive -Algorithm SHA256).Hash
@(
    "$ChromeHash  $(Split-Path -Leaf $ChromeArchive)",
    "$OperaHash  $(Split-Path -Leaf $OperaArchive)",
    "$FirefoxHash  $(Split-Path -Leaf $FirefoxArchive)",
    "$KitHash  $(Split-Path -Leaf $KitArchive)"
) | Set-Content -LiteralPath $Checksums -Encoding utf8

Write-Host "Built Chrome package: $ChromeArchive"
Write-Host "Built Opera package:  $OperaArchive"
Write-Host "Built Firefox package: $FirefoxArchive"
Write-Host "Built submission kit: $KitArchive"
Write-Host "SHA256 checksums:      $Checksums"
