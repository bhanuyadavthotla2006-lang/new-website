/*
  PowerShell script to register the agent as a scheduled task for the current user on login.
  Usage: Open PowerShell as Administrator and run: .\register-service.ps1
*/

$TaskName = "JarvisAgent"
$NodePath = (Get-Command node).Source
$ScriptPath = "{0}\agent\node_modules\.bin\ts-node" -f (Split-Path -Parent $MyInvocation.MyCommand.Definition)
# Instead point directly to the start command in the repo: run npm run start in agent folder
$Action = "cmd.exe /c cd \"$PSScriptRoot\" & cd agent & npm run start"

Write-Host "Creating scheduled task $TaskName to run at logon..."

$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c cd \"$PSScriptRoot\" & cd agent & npm run start"

Register-ScheduledTask -TaskName $TaskName -Trigger $trigger -Action $action -Principal $principal -Settings $settings -Force

Write-Host "Scheduled task created. It will run at next logon."