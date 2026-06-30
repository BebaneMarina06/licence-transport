@echo off
REM Demarrage API licence transport sur le port dedie 8010
cd /d "%~dp0..\services\api"
if not exist ".venv\Scripts\uvicorn.exe" (
  echo [ERREUR] Environnement virtuel introuvable. Executez d'abord :
  echo   python -m venv .venv
  echo   .venv\Scripts\pip install -r requirements.txt
  pause
  exit /b 1
)
echo.
echo  API Licence Transport -> http://127.0.0.1:8010
echo  Documentation        -> http://127.0.0.1:8010/docs
echo.
".venv\Scripts\uvicorn.exe" app.main:app --reload --port 8010 --host 127.0.0.1
