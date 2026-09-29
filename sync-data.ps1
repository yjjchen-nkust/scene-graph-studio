<#
.SYNOPSIS
    Copy data/ between this checkout and the NAS; git carries none of it.

.DESCRIPTION
    Nothing under data/ travels through git (D109): .gitignore ignores the whole directory and
    the remote holds none of it. The NAS holds it instead, and this script copies it there and
    back. A fresh clone therefore has no data/ at all: run .\sync-data.ps1 -Pull before
    .\start.ps1 or npm run ci.

    The set this script copies is not a list written here: it is what git reports as ignored
    under data/, which since D109 is the whole directory (D108 began with the part git already
    ignored). Two guards follow from that. A push copies only what git ignores. A pull refuses
    to start when any file on the NAS would land on a path git does not ignore, because such a
    file would either overwrite a committed one or show up as untracked and be committed by the
    next careless 'git add'.

    One file stays on each machine: data/predictions/.latency.json, the timings each machine
    reports for itself in PROVENANCE.md.

    Copies are additive. A file newer on the destination is never overwritten, and a file
    deleted on one side is not deleted on the other; remove it on both by hand.

    The NAS copy is the author's own storage between the author's own machines. It is not a
    route for handing images to a class: bundle_distribute in data/LICENCES.md governs that,
    and it is NO for psg, vg150-sgb and indoorvg.

.PARAMETER Status
    Compare data/ here with the NAS, group by group, and exit. The default.

.PARAMETER Push
    Copy data/ from this checkout to the NAS.

.PARAMETER Pull
    Copy the NAS copy into data/, after checking every file lands on an ignored path.

.PARAMETER Nas
    The NAS directory that stands for data/. Defaults to SGS_DATA_NAS, else C:\DataRaw\scene-graph.

.PARAMETER DryRun
    With -Push or -Pull, list what would be copied and copy nothing.

.EXAMPLE
    .\sync-data.ps1
    Show which groups differ between this checkout and the NAS, and in which direction.

.EXAMPLE
    .\sync-data.ps1 -Push
    Copy data/ to the NAS after changing anything in it: a harvest, a cut, a new checkpoint.

.EXAMPLE
    .\sync-data.ps1 -Pull
    On a fresh clone, or after another machine pushed, bring data/ from the NAS.
#>
[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
    [Parameter(ParameterSetName = 'Status')][switch]$Status,
    [Parameter(ParameterSetName = 'Push')][switch]$Push,
    [Parameter(ParameterSetName = 'Pull')][switch]$Pull,
    [string]$Nas,
    [Parameter(ParameterSetName = 'Push')]
    [Parameter(ParameterSetName = 'Pull')]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$track = $PSScriptRoot
$data  = Join-Path $track 'data'
if (-not $Nas) { $Nas = if ($env:SGS_DATA_NAS) { $env:SGS_DATA_NAS } else { 'C:\DataRaw\scene-graph' } }
$Nas = $Nas.TrimEnd('\', '/')

# Written per machine and reported per machine in PROVENANCE.md. Copying it would make one
# machine report another machine's timings.
$machineLocal = @('predictions/.latency.json')

# Paths go to git and come back as UTF-8 text; without this a non-ASCII name arrives mangled.
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

function Write-Ok   { param([string]$T) Write-Host "  $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "  $T" -ForegroundColor Yellow }
function Write-Bad  { param([string]$T) Write-Host "  $T" -ForegroundColor Red }
function Write-Dim  { param([string]$T) Write-Host "  $T" -ForegroundColor DarkGray }

function Format-Size {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return '{0:N1} GB' -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return '{0:N1} MB' -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return '{0:N0} KB' -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function Get-Files {
    <# Every file under $Root, keyed by its path relative to $Root with forward slashes. #>
    param([string]$Root)
    $files = @{}
    if (-not (Test-Path -LiteralPath $Root)) { return $files }
    $prefix = (Resolve-Path -LiteralPath $Root).ProviderPath.TrimEnd('\') + '\'
    foreach ($f in Get-ChildItem -LiteralPath $Root -Recurse -File -Force) {
        $files[$f.FullName.Substring($prefix.Length).Replace('\', '/')] = $f
    }
    return $files
}

function Get-IgnoredEntries {
    <# What git ignores under data/, relative to data/: a directory ends in '/', a file does not,
       and '' is data/ itself, which is the whole answer since D109. #>
    $entries = & git -C $track -c core.quotePath=false ls-files --others --ignored --exclude-standard --directory -- data
    if ($LASTEXITCODE -ne 0) { throw 'git ls-files failed; is this a checkout of the repository?' }
    # A $null piped on still runs the block once, so an empty answer returns here.
    if (-not $entries) { return @() }
    return @($entries | ForEach-Object { $_.Substring('data/'.Length) } |
        Where-Object { $machineLocal -notcontains $_ })
}

function Test-Directory {
    param([string]$Entry)
    return ($Entry -eq '' -or $Entry.EndsWith('/'))
}

function Join-Entry {
    <# $Root joined with an entry; '' is $Root itself. Robocopy reads a trailing backslash before a
       quote as an escape, so no trailing slash survives. #>
    param([string]$Root, [string]$Entry)
    $rel = $Entry.TrimEnd('/').Replace('/', '\')
    if ($rel) { return (Join-Path $Root $rel) }
    return $Root
}

function Get-LocalFiles {
    <# The files of the ignored entries, keyed as Get-Files keys them, machine-local ones left out. #>
    $files = @{}
    foreach ($entry in Get-IgnoredEntries) {
        $path = Join-Entry $data $entry
        if (Test-Directory $entry) {
            $inner = Get-Files $path
            foreach ($k in $inner.Keys) {
                if ($machineLocal -notcontains ($entry + $k)) { $files[$entry + $k] = $inner[$k] }
            }
        } elseif (Test-Path -LiteralPath $path -PathType Leaf) {
            $files[$entry] = Get-Item -LiteralPath $path -Force
        }
    }
    return $files
}

function Get-Unignored {
    <# The keys that would land on a path git does not ignore, or on a machine-local one. A tracked
       path is never reported ignored by check-ignore, so a committed file counts as unignored. #>
    param([string[]]$Keys)
    if ($Keys.Count -eq 0) { return @() }
    # NUL-separated both ways: PowerShell ends each piped line with CRLF, and git keeps the CR as
    # part of the path, so line by line no path would ever match.
    $request = (($Keys | ForEach-Object { "data/$_" }) -join "`0") + "`0"
    $answer = $request | & git -C $track check-ignore -z --stdin
    # Exit 1 means "none ignored", which is an answer; 128 is a failure.
    if ($LASTEXITCODE -gt 1) { throw 'git check-ignore failed.' }
    $set = @{}
    foreach ($p in (@($answer) -join '').Split([char]0)) {
        if ($p.StartsWith('data/')) { $set[$p.Substring('data/'.Length)] = $true }
    }
    return @($Keys | Where-Object { -not $set.ContainsKey($_) -or $machineLocal -contains $_ })
}

function Get-Group {
    <# The first two directory levels: '_raw/industreal', 'slices/psg', 'checkpoints'. #>
    param([string]$Key)
    $dirs = @($Key.Split('/') | Select-Object -SkipLast 1)
    if ($dirs.Count -eq 0) { return '.' }
    return ($dirs | Select-Object -First 2) -join '/'
}

function Test-Ahead {
    <# $A is newer than $B, beyond the two-second resolution some NAS file systems keep, and holds
       different bytes. Equal content is never ahead whatever the times say: the gate's harvest
       rewrites three files of data/content/ unchanged on every run. #>
    param($A, $B)
    if (($A.LastWriteTimeUtc - $B.LastWriteTimeUtc).TotalSeconds -le 2) { return $false }
    if ($A.Length -ne $B.Length) { return $true }
    return (Get-FileHash -LiteralPath $A.FullName).Hash -ne (Get-FileHash -LiteralPath $B.FullName).Hash
}

function Invoke-Robocopy {
    param([string]$From, [string]$To, [string[]]$Only)
    # /E subdirectories, /XO never overwrite a newer destination file, /FFT two-second times,
    # /MT:8 eight threads for the many small images, /XX no listing of files only the destination
    # holds, /XF the machine-local files by full path on either side. No /MIR, no /PURGE:
    # nothing is deleted.
    $argv = @($From, $To) + $Only + @('/E', '/XO', '/XX', '/FFT', '/MT:8', '/R:2', '/W:5', '/NP', '/NDL', '/NJH')
    $argv += @('/XF') + @($machineLocal | ForEach-Object { Join-Entry $data $_; Join-Entry $Nas $_ })
    if ($DryRun) { $argv += '/L' } else { $argv += '/NFL' }
    # To the host, not the pipeline: otherwise its lines join the returned value.
    & robocopy @argv | Out-Host
    # 0 to 7 report what was copied, skipped or extra; 8 and above report a failure.
    return ($LASTEXITCODE -lt 8)
}

function Show-Status {
    Write-Host ''
    Write-Host "  NAS  $Nas" -ForegroundColor White
    if (-not (Test-Path -LiteralPath $Nas)) {
        Write-Bad 'unreachable or absent; create it, or pass -Nas, or set SGS_DATA_NAS'
        return 1
    }
    $local = Get-LocalFiles
    $remote = Get-Files $Nas
    $groups = @{}
    foreach ($k in @($local.Keys) + @($remote.Keys)) {
        $g = Get-Group $k
        if (-not $groups.ContainsKey($g)) {
            $groups[$g] = [pscustomobject]@{ Local = 0; LocalBytes = 0L; Nas = 0; NasBytes = 0L; Push = 0; Pull = 0 }
        }
    }
    foreach ($k in $local.Keys) {
        $row = $groups[(Get-Group $k)]; $l = $local[$k]
        $row.Local++; $row.LocalBytes += $l.Length
        if (-not $remote.ContainsKey($k) -or (Test-Ahead $l $remote[$k])) { $row.Push++ }
    }
    foreach ($k in $remote.Keys) {
        $row = $groups[(Get-Group $k)]; $r = $remote[$k]
        $row.Nas++; $row.NasBytes += $r.Length
        if (-not $local.ContainsKey($k) -or (Test-Ahead $r $local[$k])) { $row.Pull++ }
    }

    Write-Host ''
    if ($groups.Count -eq 0) { Write-Dim 'nothing ignored under data/ here, and nothing on the NAS' }
    foreach ($g in $groups.Keys | Sort-Object) {
        $row = $groups[$g]
        $text = '{0} here {1,5} files {2,9}   NAS {3,5} files {4,9}' -f $g.PadRight(24),
            $row.Local, (Format-Size $row.LocalBytes), $row.Nas, (Format-Size $row.NasBytes)
        if ($row.Push -eq 0 -and $row.Pull -eq 0) { Write-Ok "$text   in step"; continue }
        $todo = @()
        if ($row.Push) { $todo += "$($row.Push) to push" }
        if ($row.Pull) { $todo += "$($row.Pull) to pull" }
        Write-Warn "$text   $($todo -join ', ')"
    }
    $refused = @(Get-Unignored @($remote.Keys))
    if ($refused.Count) {
        Write-Host ''
        Write-Bad "$($refused.Count) file(s) on the NAS map to paths git does not ignore; -Pull will refuse:"
        $refused | Select-Object -First 10 | ForEach-Object { Write-Bad "  $_" }
    }
    Write-Host ''
    Write-Dim 'Copies are additive: a newer file is never overwritten and nothing is deleted (D108, D109).'
    Write-Host ''
    return 0
}

function Invoke-Push {
    $entries = Get-IgnoredEntries
    if ($entries.Count -eq 0) { Write-Warn 'Nothing ignored under data/; nothing to push.'; return 0 }
    New-Item -ItemType Directory -Force -Path $Nas | Out-Null
    $failed = 0
    foreach ($entry in $entries) {
        Write-Host ''
        Write-Host "  push data/$entry" -ForegroundColor Cyan
        $from = Join-Entry $data $entry
        $to = Join-Entry $Nas $entry
        $ok = if (Test-Directory $entry) { Invoke-Robocopy $from $to @() }
              else { Invoke-Robocopy (Split-Path $from) (Split-Path $to) @(Split-Path -Leaf $from) }
        if (-not $ok) { $failed++ }
    }
    return [int]($failed -gt 0)
}

function Invoke-Pull {
    if (-not (Test-Path -LiteralPath $Nas)) { Write-Bad "No such directory: $Nas"; return 1 }
    $remote = Get-Files $Nas
    if ($remote.Count -eq 0) { Write-Warn "The NAS copy at $Nas is empty; nothing to pull."; return 0 }
    $refused = @(Get-Unignored @($remote.Keys))
    if ($refused.Count) {
        Write-Bad "Refused: $($refused.Count) file(s) on the NAS would land on paths git does not ignore."
        Write-Bad 'Each would overwrite a committed file or be committed by the next git add:'
        $refused | ForEach-Object { Write-Bad "  $_" }
        return 1
    }
    Write-Host ''
    Write-Host "  pull $Nas into data/" -ForegroundColor Cyan
    # Every file passed the check above, so the NAS tree can be copied whole.
    return [int](-not (Invoke-Robocopy $Nas $data @()))
}

switch ($PSCmdlet.ParameterSetName) {
    'Push'  { exit (Invoke-Push) }
    'Pull'  { exit (Invoke-Pull) }
    default { exit (Show-Status) }
}
