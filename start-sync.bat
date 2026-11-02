@echo off
title IPO Auto Sync Service (Every 1 Minute)
color 0A
cd /d "%~dp0"
echo ========================================================
echo       IPO AUTO SYNC BACKGROUND RUNNER (EVERY 1 MINUTE)
echo ========================================================
echo.
echo Mode: Auto-Repeat (Every 1 minute)
echo To stop the auto-sync, close this window or press Ctrl+C.
echo.
node sync-cron.js --interval 1
pause
