@echo off
setlocal EnableDelayedExpansion
title YiDing IT Agent - Setup
color 0A

echo.
echo  ================================
echo   YiDing IT Agent - Cai dat
echo  ================================
echo.

:: Kiem tra quyen Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [LOI] Vui long chay file nay voi quyen Administrator
    echo  Right-click - "Run as administrator"
    pause & exit /b 1
)

set INSTALL_DIR=C:\YiDingHrAgent

:: ── Mode 1: Da co EXE san (deploy nhanh) ──────────────────────────────────
if exist "%~dp0YiDingITAgent.exe" (
    echo  [EXE] Tim thay YiDingITAgent.exe - dung che do deploy nhanh
    echo  [1/3] Tao thu muc %INSTALL_DIR%...
    if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
    mkdir "%INSTALL_DIR%"

    echo  [2/3] Copy files...
    copy /Y "%~dp0YiDingITAgent.exe" "%INSTALL_DIR%\" >nul
    if exist "%~dp0chichi.jpg"      copy /Y "%~dp0chichi.jpg"      "%INSTALL_DIR%\" >nul
    if exist "%~dp0chichi.png"      copy /Y "%~dp0chichi.png"      "%INSTALL_DIR%\" >nul
    if exist "%~dp0yiding_logo.png" copy /Y "%~dp0yiding_logo.png" "%INSTALL_DIR%\" >nul
    if exist "%~dp0yiding_logo.ico" copy /Y "%~dp0yiding_logo.ico" "%INSTALL_DIR%\" >nul

    echo  [3/3] Dang ky khoi dong cung Windows...
    reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "YiDingITAgent" /t REG_SZ /d "\"%INSTALL_DIR%\YiDingITAgent.exe\"" /f >nul

    echo  Dang khoi dong agent...
    taskkill /f /im YiDingITAgent.exe >nul 2>&1
    start "" /B "%INSTALL_DIR%\YiDingITAgent.exe"
    goto :done
)

:: ── Mode 2: Dung Python (fallback) ────────────────────────────────────────
echo  [Python] Khong co EXE - dung che do Python

echo  [1/5] Kiem tra Python...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [LOI] Chua co Python. Dang mo trang tai...
    start https://www.python.org/downloads/release/python-31110/
    echo  Cai Python 3.11 xong roi chay lai file nay.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo  OK: %%v

echo  [2/5] Copy files vao %INSTALL_DIR%...
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
mkdir "%INSTALL_DIR%"
copy /Y "%~dp0agent.py"          "%INSTALL_DIR%\" >nul
copy /Y "%~dp0requirements.txt"  "%INSTALL_DIR%\" >nul
if exist "%~dp0chichi.jpg"       copy /Y "%~dp0chichi.jpg"       "%INSTALL_DIR%\" >nul
if exist "%~dp0chichi.png"       copy /Y "%~dp0chichi.png"       "%INSTALL_DIR%\" >nul
if exist "%~dp0yiding_logo.png"  copy /Y "%~dp0yiding_logo.png"  "%INSTALL_DIR%\" >nul
if exist "%~dp0yiding_logo.ico"  copy /Y "%~dp0yiding_logo.ico"  "%INSTALL_DIR%\" >nul
echo  OK

echo  [3/5] Tao moi truong Python...
python -m venv "%INSTALL_DIR%\venv" >nul 2>&1
if %errorLevel% neq 0 ( echo  [LOI] Khong tao duoc venv. & pause & exit /b 1 )

echo  [4/5] Cai thu vien...
"%INSTALL_DIR%\venv\Scripts\pip" install -q -r "%INSTALL_DIR%\requirements.txt"
if %errorLevel% neq 0 ( echo  [LOI] Cai thu vien that bai. & pause & exit /b 1 )
echo  OK

echo  [5/5] Dang ky khoi dong tu dong...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "YiDingITAgent" /t REG_SZ /d "\"%INSTALL_DIR%\venv\Scripts\pythonw.exe\" \"%INSTALL_DIR%\agent.py\"" /f >nul
echo  OK - Agent se tu chay khi nguoi dung dang nhap

echo.
echo  Dang khoi dong agent...
start "" /B "%INSTALL_DIR%\venv\Scripts\pythonw.exe" "%INSTALL_DIR%\agent.py"

:done
echo.
echo  ================================
echo   Cai dat hoan tat!
echo  ================================
echo   - Agent dang chay nen
echo   - Tu dong khoi dong khi dang nhap
echo   - Log tai: %INSTALL_DIR%\agent.log
echo  ================================
echo.
timeout /t 5 /nobreak >nul

del /f /q "%~f0" >nul 2>&1
