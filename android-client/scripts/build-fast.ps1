param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$argsList = @()
if ($Clean) { $argsList += "clean" }
# Fast debug iteration: assemble debug APK without lint/tests.
$argsList += ":app:assembleDebug"
$argsList += "--console=plain"

Write-Host "Running: .\gradlew.bat $($argsList -join ' ')"
& .\gradlew.bat @argsList
exit $LASTEXITCODE
