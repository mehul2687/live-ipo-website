param (
    [string]$Message = "Auto update live-ipo website"
)

$ErrorActionPreference = "Stop"
$repoPath = $PSScriptRoot
if (-not $repoPath -or -not (Test-Path $repoPath)) {
    $repoPath = "D:\LiveIPO Website"
}

Write-Host ">>> [LiveIPO Auto-Deploy] Starting deployment process for: $repoPath" -ForegroundColor Cyan

# Step 1: Terminate any zombie or hanging git processes
try {
    $stuckGit = Get-Process -Name git -ErrorAction SilentlyContinue
    if ($stuckGit) {
        Write-Host ">>> Terminating $($stuckGit.Count) lingering git process(es)..." -ForegroundColor Yellow
        $stuckGit | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
    }
} catch {
    Write-Warning "Could not stop git processes: $_"
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
try {
    # Set safe git configs on Windows
    git -C "$repoPath" config core.autocrlf true 2>$null
    git -C "$repoPath" config core.filemode false 2>$null

    # Stage all changes
    Write-Host ">>> Staging files..." -ForegroundColor Cyan
    git -C "$repoPath" add .

    # Check for modifications
    $changes = git -C "$repoPath" status --porcelain
    if (-not $changes) {
        Write-Host ">>> [LiveIPO Auto-Deploy] No uncommitted changes found. Everything is already up to date!" -ForegroundColor Green
        exit 0
    }

    # Commit
    Write-Host ">>> Committing changes: '$Message'..." -ForegroundColor Cyan
    git -C "$repoPath" commit -m "$Message"

    # Push to origin main
    Write-Host ">>> Pushing to GitHub main branch..." -ForegroundColor Cyan
    $pushOutput = git -C "$repoPath" push origin main 2>&1
    Write-Host $pushOutput

    $latestCommit = git -C "$repoPath" rev-parse --short HEAD
    Write-Host ">>> [LiveIPO Auto-Deploy] SUCCESS! Deployed commit $latestCommit to GitHub and liveipo.in." -ForegroundColor Green
    exit 0
} catch {
    Write-Error ">>> [LiveIPO Auto-Deploy] Deployment failed: $_"
    exit 1
}
