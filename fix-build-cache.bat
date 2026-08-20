@echo off
echo ========================================
echo  Fix Build Cache - Pre-download Binaries
echo ========================================
echo.
echo This script fixes the "Failed to archive download files" error by
echo manually downloading winCodeSign, nsis, and nsis-resources into the
echo electron-builder cache, using fast mirror servers.
echo.

REM The cache lives in %LOCALAPPDATA%\electron-builder\Cache on Windows
set "CACHE_DIR=%LOCALAPPDATA%\electron-builder\Cache"
set "WINCODESIGN_DIR=%CACHE_DIR%\winCodeSign"
set "NSIS_DIR=%CACHE_DIR%\nsis"
set "NSIS_RESOURCES_DIR=%CACHE_DIR%\nsis\nsis-resources"

echo Cache directory: %CACHE_DIR%
echo.

REM Create cache directories
if not exist "%WINCODESIGN_DIR%" mkdir "%WINCODESIGN_DIR%"
if not exist "%NSIS_DIR%" mkdir "%NSIS_DIR%"
if not exist "%NSIS_RESOURCES_DIR%" mkdir "%NSIS_RESOURCES_DIR%"

REM Check if curl is available (Windows 10+ has it built-in)
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: curl not found. Please install curl or use Windows 10+.
    pause
    exit /b 1
)

REM ─── winCodeSign ───
echo [1/3] Checking winCodeSign...
if exist "%WINCODESIGN_DIR%\winCodeSign-2.6.0.7z" (
    echo     Already cached: winCodeSign-2.6.0.7z
) else (
    echo     Downloading winCodeSign-2.6.0.7z from mirror...
    curl -L -o "%WINCODESIGN_DIR%\winCodeSign-2.6.0.7z" "https://npmmirror.com/mirrors/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
    if %errorlevel% neq 0 (
        echo     Trying GitHub fallback...
        curl -L -o "%WINCODESIGN_DIR%\winCodeSign-2.6.0.7z" "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
    )
    if exist "%WINCODESIGN_DIR%\winCodeSign-2.6.0.7z" (
        echo     OK: winCodeSign downloaded successfully.
    ) else (
        echo     FAILED: Could not download winCodeSign.
        echo     Try manually downloading from:
        echo     https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z
        echo     And place it at: %WINCODESIGN_DIR%\winCodeSign-2.6.0.7z
    )
)
echo.

REM ─── nsis ───
echo [2/3] Checking nsis...
if exist "%NSIS_DIR%\nsis-3.0.4.1.7z" (
    echo     Already cached: nsis-3.0.4.1.7z
) else (
    echo     Downloading nsis-3.0.4.1.7z from mirror...
    curl -L -o "%NSIS_DIR%\nsis-3.0.4.1.7z" "https://npmmirror.com/mirrors/electron-builder-binaries/nsis-3.0.4.1/nsis-3.0.4.1.7z"
    if %errorlevel% neq 0 (
        echo     Trying GitHub fallback...
        curl -L -o "%NSIS_DIR%\nsis-3.0.4.1.7z" "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z"
    )
    if exist "%NSIS_DIR%\nsis-3.0.4.1.7z" (
        echo     OK: nsis downloaded successfully.
    ) else (
        echo     FAILED: Could not download nsis.
    )
)
echo.

REM ─── nsis-resources ───
echo [3/3] Checking nsis-resources...
if exist "%NSIS_RESOURCES_DIR%\nsis-resources-3.4.1.7z" (
    echo     Already cached: nsis-resources-3.4.1.7z
) else (
    echo     Downloading nsis-resources-3.4.1.7z from mirror...
    curl -L -o "%NSIS_RESOURCES_DIR%\nsis-resources-3.4.1.7z" "https://npmmirror.com/mirrors/electron-builder-binaries/nsis-resources-3.4.1/nsis-resources-3.4.1.7z"
    if %errorlevel% neq 0 (
        echo     Trying GitHub fallback...
        curl -L -o "%NSIS_RESOURCES_DIR%\nsis-resources-3.4.1.7z" "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources-3.4.1/nsis-resources-3.4.1.7z"
    )
    if exist "%NSIS_RESOURCES_DIR%\nsis-resources-3.4.1.7z" (
        echo     OK: nsis-resources downloaded successfully.
    ) else (
        echo     FAILED: Could not download nsis-resources.
    )
)
echo.

REM ─── Electron binary (for the matching version) ───
echo [Bonus] Pre-downloading Electron v33.4.11 for win32-x64...
set "ELECTRON_CACHE=%LOCALAPPDATA%\electron\Cache"
if not exist "%ELECTRON_CACHE%" mkdir "%ELECTRON_CACHE%"
if exist "%ELECTRON_CACHE%\electron-v33.4.11-win32-x64.zip" (
    echo     Already cached: electron-v33.4.11-win32-x64.zip
) else (
    curl -L -o "%ELECTRON_CACHE%\electron-v33.4.11-win32-x64.zip" "https://npmmirror.com/mirrors/electron/33.4.11/electron-v33.4.11-win32-x64.zip"
    if exist "%ELECTRON_CACHE%\electron-v33.4.11-win32-x64.zip" (
        echo     OK: Electron binary downloaded.
    ) else (
        echo     WARNING: Could not pre-download Electron. electron-builder will try during build.
    )
)
echo.

echo ========================================
echo  Cache setup complete!
echo ========================================
echo.
echo Now run build-exe.bat again — the "Failed to archive download files"
echo error should be resolved because all binaries are already cached.
echo.
pause
