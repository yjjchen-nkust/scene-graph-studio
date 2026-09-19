<#
.SYNOPSIS
    Resolve the Python interpreter this project runs on: the global virtual environment py12.

.DESCRIPTION
    The PowerShell counterpart of tools/py.mjs, and it applies the same order:

      1. an explicit -Requested value (start.ps1's -Python, fetch-data.ps1's -Python)
      2. SGS_PYTHON
      3. an activated environment whose directory is named py12
      4. py12 on disk: PY12_HOME first, then the known locations
      5. no py12 -- warn, then let the user pick one of their own environments

    Step 5 is the reason this is a function and not a constant. A machine without py12 is not a
    fault to abort on, but it is also not a case to resolve silently: the user is told what is
    missing and chooses the interpreter, so nothing installs into an environment by accident.
    Where the session cannot prompt (no console, -NonInteractive, a hook, CI), the choice cannot
    be offered, so the caller is told to pass -Python or set SGS_PYTHON instead of guessing.
#>

function Get-Py12Candidates {
    <# The directories a py12 environment is looked for in, in order. #>
    $dirs = @()
    # [IO.Path]::Combine, not Join-Path: Join-Path resolves the drive and throws on a path
    # naming one that does not exist, which is exactly what an unset-up machine has.
    if ($env:PY12_HOME)   { $dirs += $env:PY12_HOME }
    if ($env:WORKON_HOME) { $dirs += [IO.Path]::Combine($env:WORKON_HOME, 'py12') }
    if ($env:USERPROFILE) {
        $dirs += [IO.Path]::Combine($env:USERPROFILE, 'pyVenv', 'py12')
        $dirs += [IO.Path]::Combine($env:USERPROFILE, '.virtualenvs', 'py12')
        $dirs += [IO.Path]::Combine($env:USERPROFILE, 'venvs', 'py12')
    }
    $dirs += 'C:\Python\pyVenv\py12'
    $dirs += 'C:\venvs\py12'
    $dirs += 'D:\Python\pyVenv\py12'
    return $dirs
}

function Get-VenvInterpreter {
    param([string]$Dir)
    if (-not $Dir) { return $null }
    $exe = [IO.Path]::Combine($Dir, 'Scripts', 'python.exe')
    if (Test-Path -LiteralPath $exe) { return (Resolve-Path -LiteralPath $exe).Path }
    return $null
}

function Find-LocalVirtualEnvs {
    <#
      Every virtual environment this machine plausibly has, for the menu shown when py12 is
      absent. A directory counts only when it holds both pyvenv.cfg and Scripts\python.exe,
      which is what separates an environment from a folder that merely looks like one.
    #>
    $roots = @(
        'C:\Python\pyVenv', 'C:\venvs', 'D:\Python\pyVenv'
    )
    if ($env:USERPROFILE) {
        $roots += [IO.Path]::Combine($env:USERPROFILE, 'pyVenv')
        $roots += [IO.Path]::Combine($env:USERPROFILE, '.virtualenvs')
        $roots += [IO.Path]::Combine($env:USERPROFILE, 'venvs')
    }
    if ($env:WORKON_HOME) { $roots += $env:WORKON_HOME }

    $found = [ordered]@{}
    $seen = @{}
    foreach ($root in ($roots | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        foreach ($dir in (Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            if (-not (Test-Path -LiteralPath ([IO.Path]::Combine($dir.FullName, 'pyvenv.cfg')))) { continue }
            $exe = Get-VenvInterpreter $dir.FullName
            if (-not $exe -or $found.Contains($exe)) { continue }
            $identity = Get-VenvIdentity $dir.FullName
            if ($seen.ContainsKey($identity)) { continue }
            $seen[$identity] = $true
            $found[$exe] = $dir.Name
        }
    }
    # A project-local .venv counts too, and is listed first when it exists.
    $local = Get-VenvInterpreter ([IO.Path]::Combine((Get-Location).Path, '.venv'))
    if ($local -and -not $found.Contains($local)) { $found[$local] = '.venv (this directory)' }
    return $found
}

function Get-PythonVersionString {
    param([string]$Exe)
    try { return (& $Exe --version 2>&1).ToString().Trim() } catch { return 'version unknown' }
}

function Get-VenvIdentity {
    <#
      What makes two discovered directories the same environment. The path alone will not do:
      D:\Python here is a junction to C:\Python, so every environment was found twice and the
      menu offered each of them under two names. pyvenv.cfg records the interpreter it was
      built from and the command that built it, which is identity enough to collapse those.
    #>
    param([string]$Dir)
    $cfg = [IO.Path]::Combine($Dir, 'pyvenv.cfg')
    if (Test-Path -LiteralPath $cfg) {
        return ((Get-FileHash -LiteralPath $cfg -Algorithm SHA256).Hash + '|' + (Split-Path -Leaf $Dir))
    }
    return $Dir
}

function Test-CanPrompt {
    <#
      Whether this session can ask a question. [Environment]::UserInteractive is true even in a
      shell started with -NonInteractive, where Read-Host throws instead of reading, so the
      command line is inspected as well -- and the prompt itself is still guarded, because a
      redirected stdin fails the same way and cannot be detected in advance.
    #>
    if ($env:CI) { return $false }
    if (-not [Environment]::UserInteractive) { return $false }
    foreach ($arg in [Environment]::GetCommandLineArgs()) {
        if ($arg -match '^-+NonI') { return $false }
    }
    return $true
}

function Resolve-ProjectPython {
    <#
    .PARAMETER Requested
        An interpreter the caller was given on the command line. Passed through untouched.
    .PARAMETER Quiet
        Suppress the line naming the interpreter that was chosen.
    .OUTPUTS
        The full path to the interpreter, or $null when the user declined to choose one.
    #>
    [CmdletBinding()]
    param(
        [string]$Requested,
        [switch]$Quiet
    )

    function Write-PyInfo { param([string]$T) if (-not $Quiet) { Write-Host "  $T" -ForegroundColor Green } }
    function Write-PyWarn { param([string]$T) Write-Host "  $T" -ForegroundColor Yellow }

    # 1 / 2 -- explicit choices, honoured as given.
    foreach ($explicit in @($Requested, $env:SGS_PYTHON)) {
        if (-not $explicit) { continue }
        $cmd = Get-Command $explicit -ErrorAction SilentlyContinue
        if (-not $cmd) {
            Write-PyWarn "'$explicit' was asked for but is not on PATH and is not a file."
            return $null
        }
        Write-PyInfo "$(Get-PythonVersionString $cmd.Source)  ($($cmd.Source))"
        return $cmd.Source
    }

    # 3 -- an activated py12 is the user's own choice, already made.
    if ($env:VIRTUAL_ENV -and (Split-Path -Leaf $env:VIRTUAL_ENV) -eq 'py12') {
        $active = Get-VenvInterpreter $env:VIRTUAL_ENV
        if ($active) {
            Write-PyInfo "$(Get-PythonVersionString $active)  (activated py12)"
            return $active
        }
    }

    # 4 -- py12 on disk.
    foreach ($dir in (Get-Py12Candidates)) {
        $exe = Get-VenvInterpreter $dir
        if ($exe) {
            Write-PyInfo "$(Get-PythonVersionString $exe)  (py12: $dir)"
            return $exe
        }
    }

    # 5 -- no py12. Say so, then let the user choose rather than silently using PATH.
    Write-Host ''
    Write-PyWarn 'The py12 environment was not found on this machine.'
    Write-PyWarn 'This project expects the global virtual environment py12 (Python 3.12), normally'
    Write-PyWarn 'at C:\Python\pyVenv\py12. Create it with:'
    Write-Host   '      python -m venv C:\Python\pyVenv\py12' -ForegroundColor DarkGray
    Write-Host   '      C:\Python\pyVenv\py12\Scripts\python -m pip install -r system\backend\requirements.txt' -ForegroundColor DarkGray
    Write-Host ''

    $options = Find-LocalVirtualEnvs
    $pathPython = (Get-Command python -ErrorAction SilentlyContinue)

    if (-not (Test-CanPrompt)) {
        Write-PyWarn 'This session cannot prompt, so no interpreter is being chosen for you.'
        Write-PyWarn 'Pass -Python <path>, or set SGS_PYTHON, and run again.'
        return $null
    }

    if ($options.Count -eq 0 -and -not $pathPython) {
        Write-PyWarn 'No virtual environment was found on this machine either, and PATH has no python.'
        return $null
    }

    Write-Host '  Choose the interpreter to use for this run:' -ForegroundColor Cyan
    $menu = @()
    foreach ($exe in $options.Keys) {
        $menu += [pscustomobject]@{ Exe = $exe; Label = "$($options[$exe])  -  $exe" }
    }
    if ($pathPython) {
        $menu += [pscustomobject]@{ Exe = $pathPython.Source; Label = "python on PATH  -  $($pathPython.Source)" }
    }
    for ($i = 0; $i -lt $menu.Count; $i++) {
        Write-Host ("    [{0}] {1}" -f ($i + 1), $menu[$i].Label)
    }
    Write-Host '    [q] quit'
    Write-Host ''

    while ($true) {
        # Guarded: a redirected stdin looks interactive until the read is attempted.
        try { $answer = Read-Host '  number' }
        catch {
            Write-PyWarn 'This session cannot read an answer. Pass -Python <path>, or set SGS_PYTHON.'
            return $null
        }
        if ($answer -in @('q', 'Q', '')) { return $null }
        $n = 0
        if ([int]::TryParse($answer, [ref]$n) -and $n -ge 1 -and $n -le $menu.Count) {
            $chosen = $menu[$n - 1].Exe
            $version = Get-PythonVersionString $chosen
            if ($version -notmatch '3\.12') {
                Write-PyWarn "$version is not Python 3.12; the pinned dependencies were measured on 3.12."
            }
            Write-PyInfo "$version  ($chosen)"
            return $chosen
        }
        Write-PyWarn "Enter a number between 1 and $($menu.Count), or q."
    }
}
