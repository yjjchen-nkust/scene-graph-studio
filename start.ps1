<#
.SYNOPSIS
    Set up if needed, then run Scene Graph Studio.

.DESCRIPTION
    A Windows front door for `npm start`. The orchestration itself lives in tools/start.mjs,
    which starts the FastAPI backend and the Vite dev server together and shuts both down on
    Ctrl+C; this script only does the part that has to happen before Node can be trusted to
    run at all, and the first-run installs.

    It is safe to run repeatedly. Everything it does is skipped when already done.

    NFR-1: the application runs with no corpora and no bundle. The placeholder slice is
    generated locally and every lab is demonstrable on it. Real slices are a separate,
    optional step -- see .\fetch-data.ps1. It does need data/, which is a link this script
    makes to the NAS, C:\DataRaw\scene-graph or SGS_DATA_DIR (D110).

.PARAMETER Setup
    Force the install steps even if they appear done. Use after pulling changes that touch
    package.json or backend/requirements.txt.

.PARAMETER SkipInstall
    Skip the install checks entirely and go straight to launching.

.PARAMETER BackendPort
    Port for the FastAPI backend. Default 8000. Sets SGS_BACKEND_PORT.

.PARAMETER FrontendPort
    Port for the Vite dev server. Default 5173. Sets SGS_FRONTEND_PORT.

.PARAMETER Python
    Python executable to use. Defaults to the project's global virtual environment py12
    (Python 3.12, normally C:\Python\pyVenv\py12), which is where the backend requirements are
    installed. When py12 is absent the script says so and offers the virtual environments it
    can find on this machine, rather than falling through to whatever "python" resolves to.
    Sets SGS_PYTHON, so every Python step of the run -- the backend included -- uses it.

.EXAMPLE
    .\start.ps1
    First run: installs, generates the placeholder slice, launches both servers.

.EXAMPLE
    .\start.ps1 -BackendPort 8010 -FrontendPort 5180
    When something else already holds the default ports.

.EXAMPLE
    .\start.ps1 -Setup
    Reinstall after dependencies changed.
#>
[CmdletBinding()]
param(
    [switch]$Setup,
    [switch]$SkipInstall,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [string]$Python
)

$ErrorActionPreference = 'Stop'
# The machinery lives under system/; data/ and docs/ stayed at the track root.
# $track is where data/ is, $system is where package.json and the backend are.
$track  = $PSScriptRoot
$system = Join-Path $PSScriptRoot 'system'
Set-Location -LiteralPath $track

function Write-Step { param([string]$Text) Write-Host "  $Text" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "  $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "  $Text" -ForegroundColor Yellow }

function Stop-With {
    param([string]$Problem, [string]$Fix)
    Write-Host ''
    Write-Host "  $Problem" -ForegroundColor Red
    if ($Fix) { Write-Host "  $Fix" -ForegroundColor Yellow }
    Write-Host ''
    exit 1
}

Write-Host ''
Write-Host '  Scene Graph Studio' -ForegroundColor White
Write-Host ''

# ---- data/ is a link to the NAS (D110) ----------------------------------------------------
# No file of data/ lives in the checkout; git carries none (D109) and the link reaches the one
# copy. Made before any install, so a machine that cannot reach the data says so first.
. (Join-Path $system 'tools/Connect-DataDirectory.ps1')
$dataProblem = Connect-DataDirectory -Track $track
if ($dataProblem) {
    Stop-With $dataProblem 'SGS_DATA_DIR names the data directory when it is not C:\DataRaw\scene-graph.'
}
Write-Ok "data -> $(Get-DataTarget)"

# ---- Node (D-03: >= 22.12 is a hard prerequisite; Vite 8 refuses anything older) ----------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Stop-With 'Node is not on PATH.' 'Install Node 22 LTS or newer from https://nodejs.org/ and reopen this terminal.'
}

$nodeRaw = (& node --version).Trim()            # e.g. v24.14.1
$nodeVer = [version]($nodeRaw.TrimStart('v'))
$nodeMin = [version]'22.12.0'
if ($nodeVer -lt $nodeMin) {
    Stop-With "Node $nodeRaw is too old; Vite 8 requires >= $nodeMin (decision D-03)." `
              'Install Node 22 LTS or newer from https://nodejs.org/ and reopen this terminal.'
}
Write-Ok "node $nodeRaw"

# ---- Python -------------------------------------------------------------------------------
# The backend requirements belong to the global virtual environment py12, so that interpreter
# is what runs here -- not whatever PATH resolves first, which is how one shell ends up green
# and the next red. tools/Resolve-Python.ps1 holds the order, and it is the same order
# tools/py.mjs applies on the Node side; when py12 is missing it warns and offers a choice.
. (Join-Path $system 'tools/Resolve-Python.ps1')
$Python = Resolve-ProjectPython -Requested $Python
if (-not $Python) {
    Stop-With 'No Python interpreter was chosen, so there is nothing to run the backend on.' `
              'Create py12, or rerun with -Python <path to python.exe>.'
}

# ---- First-run installs -------------------------------------------------------------------
if (-not $SkipInstall) {
    if ($Setup -or -not (Test-Path (Join-Path $system 'node_modules'))) {
        Write-Step 'npm install'
        Push-Location $system; & npm install --no-fund --no-audit; Pop-Location
        if ($LASTEXITCODE -ne 0) { Stop-With 'npm install failed.' 'Read the error above; it is usually a network or proxy problem.' }
    } else {
        Write-Ok 'node_modules present'
    }

    $deps = & $Python -c "import fastapi, uvicorn, pydantic, PIL" 2>&1
    if ($LASTEXITCODE -ne 0 -or $Setup) {
        Write-Step 'pip install -r backend/requirements.txt'
        & $Python -m pip install -r (Join-Path $system 'backend/requirements.txt') --disable-pip-version-check -q
        if ($LASTEXITCODE -ne 0) { Stop-With 'pip install failed.' 'Read the error above.' }
    } else {
        Write-Ok 'python packages present'
    }
}

# ---- The placeholder slice (NFR-1) --------------------------------------------------------
# Generated, never downloaded, and gated by data/LICENCES.md like every other dataset --
# it clears because it is this repository's own output and no third party holds rights in it.
if (-not (Test-Path 'data/slices/placeholder/annotations.json')) {
    Write-Step 'generating the placeholder slice'
    & $Python (Join-Path $system 'backend/scripts/make_placeholders.py')
    if ($LASTEXITCODE -ne 0) {
        Stop-With 'Could not generate the placeholder slice.' `
                  'If it names data/LICENCES.md, that row must read YES for annotations_commit.'
    }
} else {
    Write-Ok 'placeholder slice present'
}

# ---- Say what data is actually available, before the browser opens ------------------------
$cutSlices = @()
if (Test-Path 'data/slices') {
    $cutSlices = @(Get-ChildItem 'data/slices' -Directory |
        Where-Object { $_.Name -ne 'placeholder' -and (Test-Path (Join-Path $_.FullName 'annotations.json')) } |
        ForEach-Object { $_.Name })
}
if ($cutSlices.Count -eq 0) {
    Write-Warn 'no real slices cut yet - running on the placeholder slice only (.\fetch-data.ps1)'
} else {
    Write-Ok ("slices: placeholder, " + ($cutSlices -join ', '))
}

# ---- Launch -------------------------------------------------------------------------------
$env:SGS_BACKEND_PORT  = "$BackendPort"
$env:SGS_FRONTEND_PORT = "$FrontendPort"
$env:SGS_PYTHON        = $Python

Write-Host ''
Write-Step "starting - backend :$BackendPort, frontend :$FrontendPort, Ctrl+C to stop"
Write-Host ''

Push-Location $system
& npm start
$code = $LASTEXITCODE
Pop-Location
exit $code
