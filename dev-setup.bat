@echo off
echo Starting C++ Test Generator Development Environment...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is required but not installed.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is required but not installed.
    pause
    exit /b 1
)

echo Setting up backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install backend dependencies
echo Installing backend dependencies...
pip install fastapi uvicorn python-multipart pydantic

REM Create temp directories
if not exist temp_projects mkdir temp_projects

REM Start backend server
echo Starting backend server...
start cmd /k "uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Setup frontend
echo Setting up frontend...
cd ..\frontend

REM Install frontend dependencies
echo Installing frontend dependencies...
call npm install

REM Start frontend development server
echo Starting frontend development server...
start cmd /k "npm run dev"

echo.
echo Development environment is ready!
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
echo Press any key to exit...
pause >nul
