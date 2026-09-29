<#
.SYNOPSIS
    Make the track's data/ a link to the directory that holds the data, the NAS by default (D110).

.DESCRIPTION
    No file of data/ lives in the checkout. data/ is a directory junction to SGS_DATA_DIR, or to
    C:\DataRaw\scene-graph when that is unset, so every reader of data/ reaches the one copy:
    the backend, the Node tools, the PowerShell scripts, and the frontend's build-time imports,
    whose JSON types need a path the compiler can follow. The link is the only place the
    location is decided.

    A junction needs no administrator and no Developer Mode, but it cannot point at a network
    share; for a \\server\share target a symbolic link is tried instead, which needs one of the
    two.

    Dot-source this file, then call Connect-DataDirectory. It returns $null when data/ is a link
    to the target, and otherwise a sentence saying what is wrong; it never deletes or moves a
    file.
#>

function Get-DataTarget {
    if ($env:SGS_DATA_DIR) { return $env:SGS_DATA_DIR.TrimEnd('\', '/') }
    return 'C:\DataRaw\scene-graph'
}

function Connect-DataDirectory {
    param(
        [Parameter(Mandatory)][string]$Track,
        [string]$Target = (Get-DataTarget)
    )
    $link = Join-Path $Track 'data'
    $item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
    if ($item -and $item.LinkType) {
        $points = @($item.Target)[0].TrimEnd('\', '/')
        if ($points -ne $Target) { return "data/ links to $points, not to $Target. Remove the link (rmdir data) and rerun." }
        if (-not (Test-Path -LiteralPath $link)) { return "data/ links to $Target, which is unreachable. Mount the NAS, or set SGS_DATA_DIR." }
        return $null
    }
    if ($item) {
        return "data/ is a real directory. No data lives in the checkout since D110: move its files to $Target, remove it, and rerun."
    }
    if (-not (Test-Path -LiteralPath $Target)) {
        return "The data directory $Target is unreachable. Mount the NAS, or set SGS_DATA_DIR to where the data is."
    }
    $type = if ($Target.StartsWith('\\')) { 'SymbolicLink' } else { 'Junction' }
    try {
        New-Item -ItemType $type -Path $link -Target $Target -ErrorAction Stop | Out-Null
    } catch {
        return "Could not create data/ as a $type to ${Target}: $($_.Exception.Message)"
    }
    return $null
}
