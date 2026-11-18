param(
    [switch]$SkipLint,
    [switch]$SkipRelease
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$failed = $false

function Invoke-Step([string]$Name, [string[]]$GradleArgs) {
    Write-Host "`n=== $Name ==="
    Write-Host ".\gradlew.bat $($GradleArgs -join ' ')"
    & .\gradlew.bat @GradleArgs
    if ($LASTEXITCODE -ne 0) { $script:failed = $true }
}

Invoke-Step "Unit tests (debug)" @(":app:testDebugUnitTest", "--console=plain")

if (-not $SkipLint) {
    # Targeted lint for key modules; full app lint can be expensive.
    Invoke-Step "Chat lint (debug analyze)" @(":feature:chat:lintAnalyzeDebug", "--console=plain")
}

Invoke-Step "Assemble debug" @(":app:assembleDebug", "--console=plain")

if (-not $SkipRelease) {
    Write-Host "`nNOTE: Release tasks require signing/env configuration (YUGM_* upload keystore and HTTPS URLs)."
    Invoke-Step "Assemble release (if configured)" @(":app:assembleRelease", "--console=plain")
}

if ($failed) { exit 1 }
exit 0
