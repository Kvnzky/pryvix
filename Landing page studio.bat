@echo off
cd /d "%~dp0"
if exist "%~dp0release\win-unpacked\LandingPageStudio.exe" (
    start "" "%~dp0release\win-unpacked\LandingPageStudio.exe"
) else (
    npm start
)
