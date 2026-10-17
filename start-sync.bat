@echo off
title IPO Auto Sync Service
color 0A
cd /d "%~dp0"
echo ========================================================
echo       IPO AUTO SYNC BACKGROUND RUNNER
echo ========================================================
echo.
echo Mode: Auto-Repeat (Every 30 minutes)
echo To stop the auto-sync, close this window or press Ctrl+C.
echo.
node sync-cron.js
pause
