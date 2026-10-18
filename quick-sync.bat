@echo off
title LiveIPO - 1-Click GitHub Sync
color 0A
cd /d "%~dp0"

echo ========================================================
echo       LIVE IPO WEBSITE - 1-CLICK GITHUB SYNC
echo ========================================================
echo.

echo [1/3] Pulling latest changes from GitHub (Laptop/Cloud)...
git pull --rebase origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Pull failed! You might have conflicting changes.
    pause
    exit /b %errorlevel%
)
echo [OK] Everything up-to-date with GitHub.
echo.

echo [2/3] Checking for local changes to upload...
git add .
git diff-index --quiet HEAD
if %errorlevel% equ 0 (
    echo [INFO] No local changes to push. Workspace is completely synced!
    echo.
    goto done
)

set COMMIT_MSG=Sync updates from %COMPUTERNAME% [%DATE% %TIME%]
set /p USER_MSG="Enter commit note (Press Enter for default): "
if not "%USER_MSG%"=="" set COMMIT_MSG=%USER_MSG%

git commit -m "%COMMIT_MSG%"
echo.

echo [3/3] Pushing changes to GitHub...
git push origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed! Please check your internet or token.
    pause
    exit /b %errorlevel%
)

:done
echo.
echo ========================================================
echo   [SUCCESS] LAPTOP, DESKTOP ^& GITHUB ARE 100%% IN SYNC!
echo ========================================================
echo.
pause
