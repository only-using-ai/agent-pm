# Install Agent PM API server to run at Windows logon (Scheduled Task).
# Run from project root: npm run daemon  (or npm run daemon:user)
# Or: powershell -ExecutionPolicy Bypass -File deploy/install-daemon.ps1 [-User]

param([switch]$User)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$TaskName = "Agent PM"
$TsxCmd = Join-Path $ProjectRoot "node_modules\.bin\tsx.cmd"
$TsxBin = Join-Path $ProjectRoot "node_modules\.bin\tsx"
$TsxCli = Join-Path $ProjectRoot "node_modules\tsx\dist\cli.mjs"

$Execute = $null
$Argument = $null
if (Test-Path $TsxCmd) {
    $Execute = $TsxCmd
    $Argument = "server/index.ts"
} elseif (Test-Path $TsxBin) {
    $Execute = $TsxBin
    $Argument = "server/index.ts"
} elseif (Test-Path $TsxCli) {
    $Execute = "node"
    $Argument = "`"$TsxCli`" server/index.ts"
} else {
    Write-Error "tsx not found. Run 'npm install' in the project root."
}

$Action = New-ScheduledTaskAction `
    -Execute $Execute `
    -Argument $Argument `
    -WorkingDirectory $ProjectRoot

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Agent PM API server (port 38472)"

Write-Host "Installed: Scheduled Task '$TaskName' (runs at logon)."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  Start now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Stop:       Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Status:     Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Run once:   Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Uninstall:  Unregister-ScheduledTask -TaskName '$TaskName'"
