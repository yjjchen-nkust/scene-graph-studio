<#
.SYNOPSIS
    Publish this track: merge a branch into main, push to Gitea and GitHub, watch the CI/CD run.

.DESCRIPTION
    GitHub Actions (.github/workflows/ci-cd.yml) is the gate and the deployment. A push to main
    runs the checks, publishes the frontend to GitHub Pages, and Render redeploys the backend from
    render.yaml. This script does the steps around that push, in order, and stops at the first
    problem. Nothing is forced: every merge is fast-forward only and every push is a plain push.

.PARAMETER Branch
    Branch to merge into main. Defaults to the current branch; on main it merges nothing.

.PARAMETER Gate
    Run `npm run ci` locally before pushing (needs the py12 environment and data/).

.PARAMETER NoWatch
    Push and return without waiting for the GitHub Actions run.

.PARAMETER DryRun
    Run every check and print what would be pushed, but push nothing.

.EXAMPLE
    .\deploy.ps1                 # merge the current branch into main, push, watch the run
    .\deploy.ps1 -DryRun         # checks only
    .\deploy.ps1 -Gate           # run the local gate first
#>
[CmdletBinding()]
param(
    [string]$Branch,
    [switch]$Gate,
    [switch]$NoWatch,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$Github = 'yjjchen-nkust/scene-graph-studio'
$PagesUrl = 'https://yjjchen-nkust.github.io/scene-graph-studio/'
$ApiUrl = 'https://scene-graph-studio-api.onrender.com/api/health'

function Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }

function Git {
    # Native commands do not throw on a non-zero exit, so check it here.
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)." }
}

function Require([string]$Command) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$Command is not installed or not on PATH."
    }
}

Require git
if (-not $NoWatch) { Require gh }

Step 'Checking the working tree and remotes'
if (& git status --porcelain) { throw 'The working tree has uncommitted changes. Commit or stash them first.' }
$remotes = @(& git remote)
if ($remotes -notcontains 'origin') { throw 'No remote named origin (Gitea).' }
if ($remotes -notcontains 'github') {
    Git remote add github "https://github.com/$Github.git"
    Write-Host "Added remote github -> https://github.com/$Github.git"
}
Git fetch origin
Git fetch github

$current = (& git branch --show-current).Trim()
if (-not $Branch) { $Branch = $current }

if ($DryRun -and $Branch -ne 'main') {
    Step "Dry run: checking that $Branch fast-forwards main"
    & git merge-base --is-ancestor main $Branch
    if ($LASTEXITCODE -ne 0) { throw "main is not an ancestor of $Branch; the merge would not be a fast-forward." }
    Write-Host "Would merge and push:"
    & git log --oneline "main..$Branch"
    return
}

if ($Branch -ne 'main') {
    Step "Merging $Branch into main (fast-forward only)"
    Git switch main
    Git merge --ff-only $Branch
} elseif ($current -ne 'main') {
    Git switch main
}

foreach ($remote in 'origin', 'github') {
    & git merge-base --is-ancestor "$remote/main" main
    if ($LASTEXITCODE -ne 0) {
        throw "main is behind or has diverged from $remote/main. Pull or rebase, then run this again."
    }
}

if ($Gate) {
    Step 'Running the local gate (npm run ci)'
    Push-Location system
    try {
        & npm run ci
        if ($LASTEXITCODE -ne 0) { throw 'The local gate failed; nothing was pushed.' }
    } finally {
        Pop-Location
    }
}

$sha = (& git rev-parse HEAD).Trim()
Step "Pushing main ($($sha.Substring(0, 7)))"
if ($DryRun) {
    Write-Host 'Dry run: would push main to origin and github.'
    & git log --oneline "github/main..main"
    return
}
Git push origin main
Git push github main

if ($NoWatch) {
    Write-Host "Pushed. Follow the run at https://github.com/$Github/actions"
    return
}

Step 'Waiting for the GitHub Actions run'
$runId = $null
for ($attempt = 0; $attempt -lt 15 -and -not $runId; $attempt++) {
    Start-Sleep -Seconds 4
    $runId = (& gh run list -R $Github --commit $sha --workflow ci-cd --json databaseId --jq '.[0].databaseId')
}
if (-not $runId) { throw "No ci-cd run appeared for $sha. Check https://github.com/$Github/actions" }
& gh run watch $runId -R $Github --exit-status
if ($LASTEXITCODE -ne 0) { throw "The run failed: https://github.com/$Github/actions/runs/$runId" }

Step 'Published'
Write-Host "Frontend: $PagesUrl"
Write-Host "Backend:  $ApiUrl (Render redeploys from render.yaml; the first request after idle takes about a minute)"
