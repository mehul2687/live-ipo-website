@echo off
title Remove Windows Task for IPO Auto-Sync
echo ========================================================
echo   Removing 'IpoAutoSync' from Windows Task Scheduler
echo ========================================================
echo.
schtasks /delete /tn "IpoAutoSync" /f
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Scheduled task removed successfully!
) else (
    echo [INFO] Task not found or already removed.
)
echo.
pause
