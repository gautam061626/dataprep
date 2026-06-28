@echo off
echo ============================================================
echo      DATAPREP STUDIO - Vintage Desktop Data Analyzer
echo ============================================================
echo.
echo Installing python dependencies...
python -m pip install -r requirements.txt
echo.
echo Launching local FastAPI + Uvicorn server...
echo.
echo Open http://127.0.0.1:8000 in your browser to access the app.
echo.
echo Press Ctrl+C in this command window to stop the server.
echo.
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
pause
