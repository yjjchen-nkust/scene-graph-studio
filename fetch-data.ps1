<#
.SYNOPSIS
    Report and obtain the slice data, by the only two routes decision D-08 allows.

.DESCRIPTION
    This does NOT download a corpus, and no script in this repository does. D-08 was revised on
    2026-09-15 to strike the corpus fetcher: "a script whose only user has already done the work
    by hand is a liability." The author downloads Visual Genome, PSG and the rest by hand, once,
    into SGS_CORPUS_ROOT (default data/_raw/, git-ignored). What this script does is everything
    around that:

      -Status   what each dataset's licence gates say, whether a slice is cut, whether its
                images are present, and which route applies. This is the default.
      -Fetch    run backend/scripts/fetch_images.py for a cut slice whose images must be
                downloaded per-image from the source rather than redistributed. Every file is
                checked against the SHA-256 in the slice's MANIFEST.json.
      -Verify   run backend/scripts/verify_bundle.py over unpacked slice images.
      -Unpack   unpack a slice bundle zip received out of band, then verify it.

    The two routes exist because two licence questions are not one (D-08, data/LICENCES.md):

      bundle_distribute = YES -> the author bundles the images and hands the class one zip.
      bundle_distribute = NO  -> each machine fetches each image from the source. That is not
                                 redistribution; the source publishes the file and nothing
                                 passes through a third party. PSG forces this: OpenPSG is MIT,
                                 but it annotates COCO photographs MIT does not reach.

    Nothing here is needed to run the application. The placeholder slice is generated locally
    and every lab is demonstrable on it (NFR-1).

.PARAMETER Status
    Report the state of every dataset and exit. Default when no other switch is given.

.PARAMETER Fetch
    Download images for a cut slice from the source, verifying each hash.

.PARAMETER Verify
    Check unpacked images against their slices' manifests.

.PARAMETER Unpack
    Path to a slice bundle zip to unpack into data/slices/, then verify.

.PARAMETER Dataset
    Which dataset to act on. Omit with -Fetch to act on every cut slice that needs it.

.PARAMETER Force
    With -Fetch, re-download images that are already present and already match their hash.

.PARAMETER Python
    Python executable. Defaults to the project's global virtual environment py12, resolved by
    system/tools/Resolve-Python.ps1; when py12 is absent the script says so and offers the
    environments it can find.

.EXAMPLE
    .\fetch-data.ps1
    Show what data exists and what each dataset still needs.

.EXAMPLE
    .\fetch-data.ps1 -Fetch -Dataset psg
    Download PSG's slice images one by one from the source, checking every hash.

.EXAMPLE
    .\fetch-data.ps1 -Unpack ..\scene-graph-studio-slices-2026-09-16.zip
    Unpack the bundle the class was given, then verify it against the manifests.
#>
[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
    [Parameter(ParameterSetName = 'Status')][switch]$Status,
    [Parameter(ParameterSetName = 'Fetch')][switch]$Fetch,
    [Parameter(ParameterSetName = 'Verify')][switch]$Verify,
    [Parameter(ParameterSetName = 'Unpack')][string]$Unpack,
    [ValidateSet('vrd', 'vg150-sgb', 'psg', 'indoorvg', 'haystack', 'mini-isg')]
    [string]$Dataset,
    [Parameter(ParameterSetName = 'Fetch')][switch]$Force,
    [string]$Python
)

$ErrorActionPreference = 'Stop'
# The machinery lives under system/; data/ and docs/ stayed at the track root.
# $track is where data/ is, $system is where package.json and the backend are.
$track  = $PSScriptRoot
$system = Join-Path $PSScriptRoot 'system'
Set-Location -LiteralPath $track

function Write-Ok   { param([string]$T) Write-Host "  $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "  $T" -ForegroundColor Yellow }
function Write-Bad  { param([string]$T) Write-Host "  $T" -ForegroundColor Red }
function Write-Dim  { param([string]$T) Write-Host "  $T" -ForegroundColor DarkGray }

# The same interpreter every other Python step of this project uses: py12, or the user's own
# choice when this machine has no py12. Resolved quietly here, because -Status prints nothing
# else about the environment and a version banner would bury the data table.
. (Join-Path $system 'tools/Resolve-Python.ps1')
$Python = Resolve-ProjectPython -Requested $Python -Quiet
if (-not $Python) {
    Write-Bad 'No Python interpreter was chosen; nothing can be fetched, verified or unpacked.'
    Write-Warn 'Create py12, or rerun with -Python <path to python.exe>.'
    exit 1
}

# Where the author's hand-downloaded corpora live. Never a committed path.
$corpusRoot = if ($env:SGS_CORPUS_ROOT) { $env:SGS_CORPUS_ROOT } else { 'data/_raw' }

# Only sources whose own licence statement has been read and recorded in data/LICENCES.md
# appear here. An unverified URL is worse than none, so the rest say so plainly.
$sources = @{
    'vg150-sgb' = 'https://huggingface.co/datasets/maelic/VG150-coco-format'
    'psg'       = 'https://github.com/Jingkang50/OpenPSG'
    'vrd'       = $null
    'indoorvg'  = 'https://huggingface.co/datasets/maelic/IndoorVG-coco-format'
    'haystack'  = $null
    'mini-isg'  = $null
}

function Read-Gates {
    <# data/LICENCES.md is the source of truth, parsed the same way app/datasets/licences.py
       parses it: a six-cell row, and anything that is not an explicit YES is closed. #>
    $path = 'data/LICENCES.md'
    $gates = @{}
    if (-not (Test-Path $path)) { return $gates }
    foreach ($line in Get-Content $path) {
        if (-not $line.StartsWith('|')) { continue }
        $cells = $line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() }
        if ($cells.Count -ne 6) { continue }
        $name = $cells[0]
        if ($name -eq 'Dataset' -or $name -eq '' -or $name -match '^[-: ]+$') { continue }
        $gates[$name] = [pscustomobject]@{
            Licence   = $cells[1]
            Url       = $cells[2]
            Checked   = $cells[3]
            Commit    = ($cells[4].ToUpper() -eq 'YES')
            Distribute = ($cells[5].ToUpper() -eq 'YES')
        }
    }
    return $gates
}

function Show-Status {
    $gates = Read-Gates
    if ($gates.Count -eq 0) {
        Write-Bad 'data/LICENCES.md is missing or unreadable. Nothing can be cut until it exists.'
        return
    }

    Write-Host ''
    Write-Host '  Corpus root (hand-downloaded, git-ignored)' -ForegroundColor White
    if (Test-Path $corpusRoot) {
        $n = @(Get-ChildItem $corpusRoot -Force -ErrorAction SilentlyContinue).Count
        Write-Ok "$corpusRoot  ($n entr$(if ($n -eq 1) {'y'} else {'ies'}))"
    } else {
        Write-Dim "$corpusRoot  (absent - nothing downloaded yet)"
    }
    Write-Host ''
    Write-Host '  Datasets' -ForegroundColor White

    foreach ($ds in @('placeholder', 'vrd', 'vg150-sgb', 'psg', 'indoorvg', 'haystack', 'mini-isg')) {
        $g = $gates[$ds]
        $dir = "data/slices/$ds"
        $cut = Test-Path "$dir/annotations.json"
        $imgs = @(Get-ChildItem "$dir/images" -File -ErrorAction SilentlyContinue).Count

        $label = $ds.PadRight(12)
        if (-not $g) { Write-Bad "$label no row in data/LICENCES.md"; continue }

        if ($ds -eq 'placeholder') {
            if ($cut) { Write-Ok "$label generated locally, $imgs image(s) - every lab runs on this" }
            else      { Write-Warn "$label not generated yet - run .\start.ps1, or python backend/scripts/make_placeholders.py" }
            continue
        }

        if (-not $g.Commit) {
            $why = if ($g.Licence) { $g.Licence } else { 'licence not yet read' }
            Write-Dim "$label gate shut ($why) - nothing may be cut"
            continue
        }

        if (-not $cut) {
            $src = $sources[$ds]
            # An empty directory is not a corpus. Creating the folder is the first thing a
            # person does before downloading, so presence must mean files.
            $dsRoot = Join-Path $corpusRoot $ds
            $have = (Test-Path $dsRoot) -and
                    @(Get-ChildItem $dsRoot -Recurse -File -ErrorAction SilentlyContinue).Count -gt 0
            Write-Warn "$label cleared to cut, but no slice cut yet"
            if ($have) {
                Write-Ok  "             corpus present in $corpusRoot"
                Write-Dim "             $Python system/backend/scripts/cut_slice.py --dataset $ds"
            } else {
                if ($src) { Write-Dim "             corpus: $src" }
                else      { Write-Dim "             corpus: source URL not yet verified - read its licence page and record it" }
                Write-Dim  "             download by hand into $corpusRoot, then:"
                Write-Dim  "             $Python system/backend/scripts/cut_slice.py --dataset $ds"
            }
            continue
        }

        $route = if ($g.Distribute) { 'bundle' } else { 'per-image fetch' }
        if ($imgs -gt 0) { Write-Ok   "$label cut, $imgs image(s) present  [$route]" }
        else             { Write-Warn "$label cut, images absent  [$route]  ->  .\fetch-data.ps1 -Fetch -Dataset $ds" }
    }

    Write-Host ''
    Write-Dim 'No script here downloads a corpus (D-08). The application does not need one.'
    Write-Host ''
}

function Invoke-Fetch {
    $gates = Read-Gates
    $targets = if ($Dataset) { @($Dataset) } else {
        @(Get-ChildItem 'data/slices' -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne 'placeholder' -and (Test-Path (Join-Path $_.FullName 'MANIFEST.json')) } |
            ForEach-Object { $_.Name })
    }
    if ($targets.Count -eq 0) {
        Write-Warn 'Nothing to fetch: no slice has been cut yet. Run .\fetch-data.ps1 for what each dataset needs.'
        return 0
    }
    $failed = 0
    foreach ($ds in $targets) {
        $g = $gates[$ds]
        if ($g -and $g.Distribute) {
            Write-Dim "$ds is cleared for bundling; its images travel in the bundle. Fetching anyway."
        }
        Write-Host ''
        Write-Host "  fetching $ds" -ForegroundColor Cyan
        $argv = @((Join-Path $system 'backend/scripts/fetch_images.py'), '--dataset', $ds)
        if ($Force) { $argv += '--force' }
        & $Python @argv
        if ($LASTEXITCODE -ne 0) { $failed++ }
    }
    return $failed
}

function Invoke-Verify {
    Write-Host ''
    & $Python (Join-Path $system 'backend/scripts/verify_bundle.py')
    return $LASTEXITCODE
}

function Invoke-Unpack {
    param([string]$Zip)
    if (-not (Test-Path -LiteralPath $Zip)) {
        Write-Bad "No such file: $Zip"
        return 1
    }
    Write-Host ''
    Write-Host "  unpacking $Zip into data/slices/" -ForegroundColor Cyan
    # -Force so re-unpacking a corrected bundle is not a puzzle; verify_bundle.py is the check
    # that matters, and it runs next.
    Expand-Archive -LiteralPath $Zip -DestinationPath 'data/slices' -Force
    Write-Ok 'unpacked'
    return (Invoke-Verify)
}

switch ($PSCmdlet.ParameterSetName) {
    'Fetch'  { exit (Invoke-Fetch) }
    'Verify' { exit (Invoke-Verify) }
    'Unpack' { exit (Invoke-Unpack -Zip $Unpack) }
    default  { Show-Status; exit 0 }
}
