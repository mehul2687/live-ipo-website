@echo off
title Setup Windows Task Scheduler for IPO Auto-Sync
cd /d "%~dp0"
echo ========================================================
echo   Windows Task Scheduler Setup for IPO Auto-Sync
echo ========================================================
echo.
echo This will create a Windows background task that runs
echo every 30 minutes silently in the background, even when
echo Visual Studio Code is closed.
echo.
echo Creating task 'IpoAutoSync'...
schtasks /create /tn "IpoAutoSync" /tr "wscript.exe \"%~dp0run-sync-silent.vbs\"" /sc MINUTE /mo 30 /f
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Windows Task 'IpoAutoSync' created successfully!
    echo It will now run every 30 minutes in the background automatically.
) else (
    echo [NOTE] If you saw an access denied error, please right-click this file
    echo and select 'Run as administrator'.
)
echo.
echo To delete or stop this automatic task anytime in future, run:
echo schtasks /delete /tn "IpoAutoSync" /f
echo.
pause
