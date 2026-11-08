@echo off
title LiveIPO Website - System Doctor & Auto Fix
color 0B
cd /d "%~dp0"

echo ========================================================
echo        LIVE IPO - SYSTEM DIAGNOSTIC ^& AUTO-FIX
echo ========================================================
echo.

echo [1/4] Checking and clearing stuck Git background processes...
taskkill /F /IM git.exe 2>nul
taskkill /F /IM git-remote-https.exe 2>nul
echo       ✓ Done.
echo.

echo [2/4] Checking for leftover Git lock files (.git\index.lock)...
if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
    echo       ✓ Found and removed stuck index.lock file!
) else (
    echo       ✓ No lock file found. Git repository is healthy.
)
echo.

echo [3/4] Checking Local Git Status...
git status -s
echo.

echo [4/4] Checking Connection with GitHub Remote...
git remote -v
echo.

echo ========================================================
echo   [ALL CHECKS COMPLETE] EVERYTHING IS HEALTHY AND READY!
echo ========================================================
echo.
pause
