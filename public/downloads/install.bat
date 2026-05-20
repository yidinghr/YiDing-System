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

:: Thu cac vi tri pho bien truoc (khong can PATH)
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "C:\Program Files\Python311\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python312\python.exe"
) do (
    if exist %%P (
        if "!PYTHON_EXE!"=="" set "PYTHON_EXE=%%~P"
    )
)

:: Thu qua PATH neu chua tim thay
if "!PYTHON_EXE!"=="" (
    python --version >nul 2>&1
    if !errorLevel! equ 0 (
        for /f "delims=" %%P in ('where python 2^>nul') do (
            if "!PYTHON_EXE!"=="" set "PYTHON_EXE=%%P"
        )
    )
)

:: Chua co - cai tu winget
if "!PYTHON_EXE!"=="" (
    echo  [*] Chua co Python. Dang cai Python 3.11 qua winget...
    winget install -e --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    echo  [*] Kiem tra lai sau khi cai...
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "C:\Program Files\Python311\python.exe"
        "C:\Python311\python.exe"
    ) do (
        if exist %%P (
            if "!PYTHON_EXE!"=="" set "PYTHON_EXE=%%~P"
        )
    )
    if "!PYTHON_EXE!"=="" (
        echo  [LOI] Khong tim thay Python sau khi cai.
        echo  Vui long cai thu cong: https://www.python.org/downloads/release/python-31110/
        echo  Tick chon "Add Python to PATH", roi chay lai file nay.
        pause & exit /b 1
    )
    echo  [OK] Da cai Python thanh cong.
)

:: Lay duong dan pythonw.exe tu python.exe
set "PYTHON_W=!PYTHON_EXE:python.exe=pythonw.exe!"
for /f "tokens=*" %%v in ('"!PYTHON_EXE!" --version 2^>^&1') do echo  OK: %%v

:: [2/5] Tao thu muc va tai agent.py
echo  [2/5] Chuan bi thu muc va tai agent...
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%"

echo  [*] Dang tai agent.py tu web...
powershell -Command "Invoke-WebRequest -Uri '%AGENT_URL%' -OutFile '%INSTALL_DIR%\agent.py' -UseBasicParsing"
if not exist "%INSTALL_DIR%\agent.py" (
    echo  [LOI] Khong tai duoc agent.py. Kiem tra ket noi internet.
    pause & exit /b 1
)
echo  OK - agent.py da san sang

:: [3/5] Tao venv
echo  [3/5] Tao moi truong Python...
"!PYTHON_EXE!" -m venv "%INSTALL_DIR%\venv"
if %errorLevel% neq 0 (
    echo  [LOI] Khong tao duoc venv. Thu chay lai.
    pause & exit /b 1
)
echo  OK

:: [4/5] Cai thu vien
echo  [4/5] Cai thu vien (co the mat 1-2 phut)...
"%INSTALL_DIR%\venv\Scripts\pip" install -q websockets==14.1 psutil==6.1.1 mss==9.0.1 Pillow==11.0.0 opencv-python==4.13.0.92
if %errorLevel% neq 0 (
    echo  [LOI] Cai thu vien that bai. Kiem tra ket noi internet.
    pause & exit /b 1
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
