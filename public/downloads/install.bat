@echo off
setlocal EnableDelayedExpansion
title YiDing IT Agent - Setup
color 0A

echo.
echo  ================================
echo   YiDing IT Agent - Cai dat
echo  ================================
echo.

:: ── Kiem tra quyen Admin ────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [LOI] Vui long chay lai voi quyen Administrator
    echo  Right-click file nay - chon "Run as administrator"
    pause & exit /b 1
)

set INSTALL_DIR=C:\YiDingHrAgent
set AGENT_URL=https://yidinginternational.com/downloads/agent.py
set LOGO_URL=https://yidinginternational.com/downloads/yiding_logo.png

:: ── Mode 1: Co EXE san - deploy khong can Python ────────────────────────────
if exist "%~dp0YiDingITAgent.exe" (
    echo  [EXE] Tim thay YiDingITAgent.exe - cai dat nhanh...
    if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
    mkdir "%INSTALL_DIR%"
    copy /Y "%~dp0YiDingITAgent.exe" "%INSTALL_DIR%\" >nul
    reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "YiDingITAgent" /t REG_SZ /d "\"%INSTALL_DIR%\YiDingITAgent.exe\"" /f >nul
    taskkill /f /im YiDingITAgent.exe >nul 2>&1
    start "" /B "%INSTALL_DIR%\YiDingITAgent.exe"
    goto :done
)

:: ── Mode 2: Python ──────────────────────────────────────────────────────────

:: [1/5] Tim Python
echo  [1/5] Kiem tra Python...
set PYTHON_EXE=
set PYTHON_W=

:: Uu tien cac duong dan cu the truoc (tranh Windows Store stub)
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
    "C:\Program Files (Arm)\Python313\python.exe"
    "C:\Program Files (Arm)\Python312\python.exe"
    "C:\Program Files (Arm)\Python311\python.exe"
) do (
    if exist %%P (
        if "!PYTHON_EXE!"=="" (
            :: Kiem tra that su chay duoc (khong phai stub)
            %%~P -c "import sys; sys.exit(0)" >nul 2>&1
            if !errorLevel! equ 0 set "PYTHON_EXE=%%~P"
        )
    )
)

:: Thu qua PATH - bo qua WindowsApps (Microsoft Store stub)
if "!PYTHON_EXE!"=="" (
    for /f "delims=" %%P in ('where python 2^>nul') do (
        if "!PYTHON_EXE!"=="" (
            echo %%P | findstr /i "WindowsApps" >nul
            if !errorLevel! neq 0 (
                :: Khong phai stub - kiem tra chay duoc khong
                "%%P" -c "import sys; sys.exit(0)" >nul 2>&1
                if !errorLevel! equ 0 set "PYTHON_EXE=%%P"
            )
        )
    )
)

:: Thu python3 neu van chua co
if "!PYTHON_EXE!"=="" (
    python3 -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorLevel! equ 0 (
        for /f "delims=" %%P in ('where python3 2^>nul') do (
            if "!PYTHON_EXE!"=="" set "PYTHON_EXE=%%P"
        )
    )
)

:: Chua co - cai tu winget
if "!PYTHON_EXE!"=="" (
    echo  [*] Chua co Python. Dang cai Python 3.11 qua winget...
    winget install -e --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    if !errorLevel! neq 0 (
        echo  [CANH BAO] winget that bai. Thu tai thu cong...
        powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.10/python-3.11.10-amd64.exe' -OutFile '%TEMP%\python_setup.exe' -UseBasicParsing"
        if exist "%TEMP%\python_setup.exe" (
            "%TEMP%\python_setup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1
            del /f /q "%TEMP%\python_setup.exe" >nul 2>&1
        )
    )
    :: Kiem tra lai
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "C:\Program Files\Python311\python.exe"
        "C:\Python311\python.exe"
    ) do (
        if exist %%P (
            if "!PYTHON_EXE!"=="" (
                %%~P -c "import sys; sys.exit(0)" >nul 2>&1
                if !errorLevel! equ 0 set "PYTHON_EXE=%%~P"
            )
        )
    )
    if "!PYTHON_EXE!"=="" (
        echo  [LOI] Khong tim thay Python sau khi cai.
        echo  Vui long cai thu cong: https://www.python.org/downloads/
        echo  Tick chon "Add Python to PATH", roi chay lai file nay.
        pause & exit /b 1
    )
    echo  [OK] Da cai Python thanh cong.
)

:: Kiem tra pythonw.exe
set "PYTHON_W=!PYTHON_EXE:python.exe=pythonw.exe!"
if not exist "!PYTHON_W!" set "PYTHON_W=!PYTHON_EXE!"

for /f "tokens=*" %%v in ('"!PYTHON_EXE!" --version 2^>^&1') do echo  OK: %%v

:: [2/5] Tao thu muc va tai agent.py
echo  [2/5] Chuan bi thu muc va tai agent...
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%"

echo  [*] Dang tai agent.py tu web...
set DOWNLOAD_OK=0
for /l %%i in (1,1,3) do (
    if !DOWNLOAD_OK! equ 0 (
        powershell -Command "try { Invoke-WebRequest -Uri '%AGENT_URL%' -OutFile '%INSTALL_DIR%\agent.py' -UseBasicParsing -TimeoutSec 30; exit 0 } catch { exit 1 }"
        if exist "%INSTALL_DIR%\agent.py" set DOWNLOAD_OK=1
        if !DOWNLOAD_OK! equ 0 (
            echo  [*] Lan thu %%i that bai, thu lai...
            timeout /t 3 /nobreak >nul
        )
    )
)
if !DOWNLOAD_OK! equ 0 (
    echo  [LOI] Khong tai duoc agent.py sau 3 lan thu. Kiem tra ket noi internet.
    pause & exit /b 1
)
echo  OK - agent.py da san sang

echo  [*] Dang tai logo cong ty...
powershell -Command "try { Invoke-WebRequest -Uri '%LOGO_URL%' -OutFile '%INSTALL_DIR%\yiding_logo.ico' -UseBasicParsing -TimeoutSec 15 } catch {}" >nul 2>&1
if exist "%INSTALL_DIR%\yiding_logo.ico" (
    echo  OK - logo da san sang
) else (
    echo  [CANH BAO] Khong tai duoc logo, se dung icon mac dinh.
)

:: [3/5] Tao venv
echo  [3/5] Tao moi truong Python...
"!PYTHON_EXE!" -m venv "%INSTALL_DIR%\venv"
if %errorLevel% neq 0 (
    echo  [LOI] Khong tao duoc venv. Thu chay lai.
    pause & exit /b 1
)
echo  OK

:: [4/5] Cai thu vien
echo  [4/5] Cai thu vien (co the mat 2-3 phut)...
"%INSTALL_DIR%\venv\Scripts\pip" install --upgrade pip -q
"%INSTALL_DIR%\venv\Scripts\pip" install -q ^
    websockets==14.1 ^
    psutil==6.1.1 ^
    mss==9.0.1 ^
    Pillow==11.0.0 ^
    opencv-python==4.13.0.92 ^
    ccl-chromium-indexeddb
if %errorLevel% neq 0 (
    echo  [CANH BAO] Mot so thu vien cai that bai. Thu cai tung cai...
    for %%L in (websockets psutil mss Pillow opencv-python ccl-chromium-indexeddb) do (
        "%INSTALL_DIR%\venv\Scripts\pip" install -q %%L
    )
)
echo  OK

:: [5/5] Dang ky khoi dong tu dong
echo  [5/5] Dang ky khoi dong cung Windows...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "YiDingITAgent" /t REG_SZ /d "\"%INSTALL_DIR%\venv\Scripts\pythonw.exe\" \"%INSTALL_DIR%\agent.py\"" /f >nul
if %errorLevel% neq 0 (
    echo  [CANH BAO] Khong dang ky duoc startup. Agent se khong tu chay khi khoi dong may.
) else (
    echo  OK - Agent se tu chay khi dang nhap
)

:: Khoi dong agent ngay
echo.
echo  Dang khoi dong agent...
taskkill /f /im pythonw.exe >nul 2>&1
start "" /B "%INSTALL_DIR%\venv\Scripts\pythonw.exe" "%INSTALL_DIR%\agent.py"

:done
echo.
echo  ================================
echo   Cai dat hoan tat!
echo  ================================
echo   Agent dang chay nen
echo   Tu dong khoi dong khi dang nhap
echo   Log: %INSTALL_DIR%\agent.log
echo  ================================
echo.
timeout /t 5 /nobreak >nul

:: Tu xoa file cai dat
del /f /q "%~f0" >nul 2>&1
