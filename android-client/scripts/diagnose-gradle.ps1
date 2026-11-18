param(
    [string]$Task = ":feature:chat:lintAnalyzeDebug",
    [int]$InfoSeconds = 120
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = Join-Path $root "build\diagnostics"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "gradle-$($Task.Replace(':','_'))-$stamp.out.log"
$errLog = Join-Path $logDir "gradle-$($Task.Replace(':','_'))-$stamp.err.log"

Write-Host "Starting: .\gradlew.bat $Task --no-parallel --max-workers=1 --info --console=plain"
Write-Host "Stdout: $outLog"
Write-Host "Stderr: $errLog"

$p = Start-Process -FilePath ".\gradlew.bat" -ArgumentList $Task,"--no-parallel","--max-workers=1","--info","--console=plain" -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

try {
    if (-not $p.WaitForExit($InfoSeconds * 1000)) {
        Write-Warning "Task still running after $InfoSeconds seconds (PID $($p.Id)). Capturing Java process snapshot..."
        Get-CimInstance Win32_Process | Where-Object { $_.Name -match "java" } | Select-Object ProcessId,ParentProcessId,CommandLine | Format-List | Out-String -Width 400
        Write-Host "To capture thread dumps (run in another shell while task runs): jcmd <pid> Thread.print -l"
        Write-Host "To stop safely: taskkill /PID $($p.Id) /T"
        exit 124
    }
    Write-Host "Exit code: $($p.ExitCode)"
    exit $p.ExitCode
} finally {
    if (-not $p.HasExited) {
        Write-Host "Process still running (PID $($p.Id)). Logs: $outLog , $errLog"
    }
}
