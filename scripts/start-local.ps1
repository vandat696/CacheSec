[CmdletBinding()]
param(
    [switch]$Studio,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $workspaceRoot 'backend'
$frontendRoot = Join-Path $workspaceRoot 'frontend'
$localRoot = Join-Path $backendRoot '.local'
$python = Join-Path $backendRoot '.venv\Scripts\python.exe'
$helper = Join-Path $PSScriptRoot 'local_configuration.py'
$logs = Join-Path $localRoot 'launcher'
$previousRoot = $env:CACHESEC_ROOT
$previousImage = $env:CACHESEC_QUOTATION_RUNTIME_IMAGE
$launcherLock = $null

function Invoke-Docker {
    param([string[]]$DockerArgs)
    & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Docker command failed. No migration or grant changes were attempted.' }
}

function Wait-Http {
    param([string]$Url, [System.Diagnostics.Process]$Process, [string]$Name)
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($Process -and $Process.HasExited) { throw "$Name stopped. See $logs." }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name is not ready. See $logs."
}

function Start-NodeService {
    param([string]$Name, [int]$Port, [string]$Entry, [string[]]$NodeArgs, [string]$Url)
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($listener) {
        foreach ($owner in ($listener.OwningProcess | Select-Object -Unique)) {
            $running = Get-CimInstance Win32_Process -Filter "ProcessId = $owner"
            if (-not $running.CommandLine -or -not $running.CommandLine.Contains($frontendRoot)) {
                throw "Port $Port belongs to another application. It has not been stopped."
            }
        }
        Wait-Http -Url $Url -Name $Name
        Write-Host "$Name already running: $Url"
        return
    }
    $node = (Get-Command node -ErrorAction Stop).Source
    $arguments = @(('"{0}"' -f $Entry)) + $NodeArgs
    $started = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $frontendRoot `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$Name.out.log") `
        -RedirectStandardError (Join-Path $logs "$Name.err.log")
    Wait-Http -Url $Url -Process $started -Name $Name
    Write-Host "$Name started (PID $($started.Id)): $Url"
}

try {
    foreach ($required in @($python, (Join-Path $frontendRoot 'node_modules'),
            (Join-Path $localRoot 'control-runtime.env'), (Join-Path $localRoot 'test-profile.json'),
            (Join-Path $localRoot 'test-worker.json'), (Join-Path $workspaceRoot 'infra\.env'))) {
        if (-not (Test-Path -LiteralPath $required)) { throw "Missing $required. Complete docs/general/setup.md first." }
    }
    & docker info --format '{{.OSType}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop with Linux containers first.' }
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    $agentConfig = Join-Path $localRoot 'agent-config'
    New-Item -ItemType Directory -Path $agentConfig -Force | Out-Null
    $agentKeyFile = Join-Path $agentConfig 'openai.env'
    if (-not (Test-Path -LiteralPath $agentKeyFile)) {
        [IO.File]::WriteAllText($agentKeyFile, "OPENAI_API_KEY=`n", [Text.UTF8Encoding]::new($false))
    }
    $launcherLock = [IO.File]::Open((Join-Path $logs 'launcher.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    & $python -X utf8 $helper prepare
    if ($LASTEXITCODE -ne 0) { throw 'Private configuration was not prepared.' }
    $profile = Get-Content -LiteralPath (Join-Path $localRoot 'test-profile.json') -Raw | ConvertFrom-Json
    $env:CACHESEC_ROOT = $workspaceRoot
    $env:CACHESEC_QUOTATION_RUNTIME_IMAGE = $profile.runtime_image
    $image = & docker image inspect $profile.runtime_image | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $image[0].Id -ne $profile.runtime_image -or
            "$($image[0].Os)/$($image[0].Architecture)" -ne $profile.platform) {
        throw 'The registered baseline runtime image is unavailable. No replacement was built.'
    }
    $existingQuotation = & docker ps -a --filter 'label=com.docker.compose.project=cachesec-quotation-dev' `
        --filter 'label=com.docker.compose.service=quotation' --format '{{.ID}}'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the existing baseline API.' }
    foreach ($containerId in $existingQuotation) {
        $baseline = & docker inspect $containerId | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0 -or $baseline[0].Config.Image -ne $profile.runtime_image) {
            throw 'The test runtime differs from the existing baseline API. Its image has not been replaced.'
        }
    }
    Write-Host 'Starting database and the two local APIs...'
    Invoke-Docker -DockerArgs @('compose', '-f', (Join-Path $workspaceRoot 'infra\compose.yaml'),
        'up', '-d', '--wait', 'db')
    Invoke-Docker -DockerArgs @('compose', '-f', (Join-Path $workspaceRoot 'infra\control.compose.yaml'),
        '-f', (Join-Path $workspaceRoot 'infra\test-workflow.compose.yaml'),
        '-f', (Join-Path $workspaceRoot 'infra\agent.compose.yaml'),
        'up', '-d', '--no-build', '--wait', 'control')
    & $python -X utf8 $helper probe-control
    if ($LASTEXITCODE -ne 0) { throw 'The local profile does not match the configured control workflow.' }
    Invoke-Docker -DockerArgs @('compose', '-f', (Join-Path $workspaceRoot 'infra\quotation.compose.yaml'),
        'up', '-d', '--no-build', '--wait', 'quotation')
    & $python -X utf8 $helper probe
    if ($LASTEXITCODE -ne 0) { throw 'API/database probe failed. Existing credentials and schema were not changed.' }

    $workerState = & $python -X utf8 $helper worker-state
    if ($LASTEXITCODE -ne 0) { throw 'Cannot check the worker lock.' }
    if ($workerState -eq 'locked') {
        Write-Host 'Worker lock already held; keeping the existing worker.'
    } else {
        $workerLog = Join-Path $logs 'worker.out.log'
        $workerConfig = Join-Path $localRoot 'test-worker.json'
        $worker = Start-Process -FilePath $python -ArgumentList @('-X', 'utf8', '-m',
            'app.testing.test_worker', ('"{0}"' -f $workerConfig)) -WorkingDirectory $backendRoot `
            -WindowStyle Hidden -PassThru -RedirectStandardOutput $workerLog `
            -RedirectStandardError (Join-Path $logs 'worker.err.log')
        $workerReady = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if ($worker.HasExited) { throw "Worker stopped. See $logs." }
            if ((Test-Path -LiteralPath $workerLog) -and
                    (Select-String -LiteralPath $workerLog -SimpleMatch 'Technical test worker ready' -Quiet)) {
                $workerReady = $true; break
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $workerReady) { throw "Worker is not ready. See $logs." }
        Write-Host "Worker started (PID $($worker.Id))."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot '.next\BUILD_ID'))) {
        Push-Location $frontendRoot
        try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } }
        finally { Pop-Location }
    }
    Start-NodeService -Name 'frontend' -Port 3000 -Entry (Join-Path $frontendRoot 'node_modules\next\dist\bin\next') `
        -NodeArgs @('start', '--hostname', '127.0.0.1', '--port', '3000') -Url 'http://127.0.0.1:3000/workspace'
    if ($Studio) {
        Start-NodeService -Name 'studio' -Port 5555 -Entry (Join-Path $frontendRoot 'node_modules\prisma\build\index.js') `
            -NodeArgs @('studio', '--config', ('"{0}"' -f (Join-Path $frontendRoot 'prisma.config.ts')),
                '--port', '5555', '--browser', 'none') -Url 'http://127.0.0.1:5555'
    }
    Write-Host 'Ready: http://127.0.0.1:3000/workspace | http://127.0.0.1:3000/quotations'
    Write-Host "API ports: control 8000, quotations 8001. Background logs: $logs"
    if (-not $NoBrowser) {
        & node --experimental-strip-types (Join-Path $frontendRoot 'scripts\open-workspace.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Cannot open the local Workspace session.' }
    }
} finally {
    if ($launcherLock) { $launcherLock.Dispose() }
    $env:CACHESEC_ROOT = $previousRoot
    $env:CACHESEC_QUOTATION_RUNTIME_IMAGE = $previousImage
}
