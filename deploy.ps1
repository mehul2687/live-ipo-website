param (
    [string]$Message = "Auto update live-ipo website"
)

$repoPath = $PSScriptRoot
if (-not $repoPath -or -not (Test-Path $repoPath)) {
    $repoPath = "D:\LiveIPO Website"
}

Write-Host ">>> [LiveIPO Auto-Deploy] Starting deployment process for: $repoPath" -ForegroundColor Cyan

# Step 1: Terminate any zombie or lingering git processes
try {
    $stuckGit = Get-Process -Name git -ErrorAction SilentlyContinue
    if ($stuckGit) {
        Write-Host ">>> Terminating $($stuckGit.Count) lingering git process(es)..." -ForegroundColor Yellow
        $stuckGit | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
    }
} catch {
    # Ignore process termination errors
}

# Step 2: Remove any stale Git locks
$lockFiles = @(
    (Join-Path $repoPath ".git\index.lock"),
    (Join-Path $repoPath ".git\HEAD.lock"),
    (Join-Path $repoPath ".git\refs\heads\main.lock")
)

foreach ($lock in $lockFiles) {
    if (Test-Path $lock) {
        Write-Host ">>> Removing stale lock file: $lock" -ForegroundColor Yellow
        Remove-Item -Force $lock -ErrorAction SilentlyContinue
    }
}

# Step 3: Run git operations
# Set safe git configs on Windows
& git -C "$repoPath" config core.autocrlf true 2>$null
& git -C "$repoPath" config core.filemode false 2>$null

# Stage all changes
Write-Host ">>> Staging files..." -ForegroundColor Cyan
& git -C "$repoPath" add .
if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> Git add failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

$env:GIT_TERMINAL_PROMPT = "0"

# Check for modifications
$changes = & git -C "$repoPath" status --porcelain
$aheadCount = (& git -C "$repoPath" rev-list --count "origin/main..HEAD" 2>$null)
if (-not $changes -and ([int]$aheadCount -le 0)) {
    Write-Host ">>> [LiveIPO Auto-Deploy] No uncommitted or unpushed changes found. Everything is already up to date!" -ForegroundColor Green
    exit 0
}

if ($changes) {
    # Commit
    Write-Host ">>> Committing changes: '$Message'..." -ForegroundColor Cyan
    & git -C "$repoPath" commit -m "$Message"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ">>> Git commit failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    Write-Host ">>> Found $aheadCount unpushed local commit(s), pushing to origin/main..." -ForegroundColor Yellow
}

# Push to origin main
Write-Host ">>> Pushing to GitHub main branch..." -ForegroundColor Cyan
& git -C "$repoPath" push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> Git push failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

$latestCommit = & git -C "$repoPath" rev-parse --short HEAD
Write-Host ">>> [LiveIPO Auto-Deploy] SUCCESS! Deployed commit $latestCommit to GitHub and liveipo.in." -ForegroundColor Green
exit 0
