param(
    [ValidateSet("debug", "release")]
    [string]$Variant = "debug",
    [switch]$Lint
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($Lint) {
    if ($Variant -eq "release") {
        $task = ":feature:chat:lintRelease"
    } else {
        $task = ":feature:chat:lintAnalyzeDebug"
    }
} else {
    if ($Variant -eq "release") {
        $task = ":feature:chat:compileReleaseKotlin"
    } else {
        $task = ":feature:chat:compileDebugKotlin"
    }
}

Write-Host "Running: .\gradlew.bat $task --console=plain"
& .\gradlew.bat $task --console=plain
exit $LASTEXITCODE
