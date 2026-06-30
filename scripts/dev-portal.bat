@echo off
REM Demarrage portail citoyen (proxy /api -> 127.0.0.1:8010)
cd /d "%~dp0..\apps\portal-citoyen"
echo.
echo  Portail -> http://localhost:5173  (port fixe, strictPort)
echo  (API : scripts\dev-api.bat sur le port 8010)
echo.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr LISTENING') do (
  echo  Liberation du port 5173 ^(PID %%a^)...
  taskkill /PID %%a /F >nul 2>&1
)
echo.
npm run dev
