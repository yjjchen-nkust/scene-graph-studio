<#
.SYNOPSIS
    Make the track's data/ a link to the directory that holds the data, the NAS by default (D110).

.DESCRIPTION
    No file of data/ lives in the checkout. data/ is a directory junction to SGS_DATA_DIR, or,
    when that is unset, to the place data.toml's `source` names under remotex devdata's machine
    roots (D125), so every reader of data/ reaches the one copy: the backend, the Node tools, the
    PowerShell scripts, and the frontend's build-time imports, whose JSON types need a path the
    compiler can follow. No tracked file spells the location: data.toml names it by root, and
    the roots file, outside every repository, maps the root to a folder on this machine. This
    script makes the link `devdata pull` makes, for a machine without remotex installed.

    A junction needs no administrator and no Developer Mode, but it cannot point at a network
    share; for a \\server\share target a symbolic link is tried instead, which needs one of the
    two.

    Dot-source this file, then call Connect-DataDirectory. It returns $null when data/ is a link
    to the target, and otherwise a sentence saying what is wrong; it never deletes or moves a
    file.
#>

function Get-DataTarget {
    <#
    .OUTPUTS
        Where data/ links to: SGS_DATA_DIR when set; otherwise data.toml's `source`, its root read
        from devdata's roots file (DEVDATA_ROOTS_FILE, else ~/.config/devdata/roots.toml), as
        `devdata pull` reads them. $null when neither says.
    #>
    param([string]$Track = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
    if ($env:SGS_DATA_DIR) { return $env:SGS_DATA_DIR.TrimEnd('\', '/') }
    $manifest = Join-Path $Track 'data.toml'
    $roots = if ($env:DEVDATA_ROOTS_FILE) { $env:DEVDATA_ROOTS_FILE } else { Join-Path $HOME '.config/devdata/roots.toml' }
    if (-not (Test-Path -LiteralPath $manifest) -or -not (Test-Path -LiteralPath $roots)) { return $null }
    $source = Select-String -LiteralPath $manifest -Pattern '^\s*source\s*=\s*"([A-Za-z0-9_-]+):([^"]+)"' |
        Select-Object -First 1
    if (-not $source) { return $null }
    $rootName = $source.Matches[0].Groups[1].Value
    $path = $source.Matches[0].Groups[2].Value
    $inRoots = $false
    foreach ($line in Get-Content -LiteralPath $roots) {
        if ($line -match '^\s*\[(.+)\]\s*$') { $inRoots = $Matches[1].Trim() -eq 'roots'; continue }
        if ($inRoots -and $line -match ('^\s*' + [regex]::Escape($rootName) + '\s*=\s*[''"]([^''"]+)[''"]')) {
            # Not Join-Path, which throws when the root's drive is not mounted: an unreachable
            # target is Connect-DataDirectory's to report, as a sentence.
            return [IO.Path]::Combine($Matches[1], $path).Replace('/', '\').TrimEnd('\')
        }
    }
    return $null
}

function Connect-DataDirectory {
    param(
        [Parameter(Mandatory)][string]$Track,
        [string]$Target = (Get-DataTarget -Track $Track)
    )
    if (-not $Target) {
        return "No data location is configured. Install remotex's devdata and write its roots file " +
            "(roots.toml.example in remotex) with the root data.toml names, or set SGS_DATA_DIR."
    }
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
