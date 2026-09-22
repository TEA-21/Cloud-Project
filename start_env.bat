@echo off
setlocal

:: Support direct shutdown command: start_env.bat stop
if "%~1"=="stop" goto cleanup

title AELA Full-Stack Environment Manager

echo ========================================================
echo  Starting AELA Cloud Security Environment (Full-Stack)
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Launch Backend Mock Server on port 8000
echo [1/2] Starting Python Mock Backend on port 8000...
start "AELA-Backend" /B cmd /c "python tests\jmeter_plans\mock_server.py"

:: Delay for backend initialization
ping 127.0.0.1 -n 3 >nul

:: 2. Launch Vite Frontend on port 3000
echo [2/2] Starting Vite Frontend on port 3000...
start "AELA-Frontend" /B cmd /c "cd /d "%~dp0frontend" && call npm run dev"

:: Delay for frontend initialization
ping 127.0.0.1 -n 4 >nul

echo.
echo ========================================================
echo  AELA Full-Stack Environment is Running!
echo  - Backend API:  http://127.0.0.1:8000
echo  - Frontend App: http://localhost:3000
echo ========================================================
echo Press any key to shut down all services...
echo (Or run "start_env.bat stop" in another terminal)
echo.

pause >nul

:cleanup
echo.
echo ========================================================
echo  Shutting down AELA services...
echo ========================================================

:: Gracefully terminate processes listening on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Stopping Backend PID %%a on port 8000
    taskkill /F /T /PID %%a >nul 2>&1
)

:: Gracefully terminate processes listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Stopping Frontend PID %%a on port 3000
    taskkill /F /T /PID %%a >nul 2>&1
)

echo All services stopped cleanly.
