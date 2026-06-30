@echo off
REM Demarre l'API (8010) et le portail citoyen (5173) dans deux fenetres separees
cd /d "%~dp0.."

echo.
echo  Licence Transport — demarrage dev
echo  =================================
echo  API     -> http://127.0.0.1:8010
echo  Portail -> http://localhost:5173
echo.

start "API Licence Transport (8010)" cmd /k "cd /d %~dp0..\services\api && .venv\Scripts\uvicorn app.main:app --reload --port 8010 --host 127.0.0.1"

timeout /t 4 /nobreak >nul

start "Portail Citoyen (5173)" cmd /k "cd /d %~dp0..\apps\portal-citoyen && npm run dev"

echo  Deux fenetres ont ete ouvertes. Attendez le message "API licence transport OK" dans le portail.
echo.
