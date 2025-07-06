#!/bin/bash

# C++ Test Generator - Development Setup Script

echo "🚀 Starting C++ Test Generator Development Environment"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to cleanup processes on exit
cleanup() {
    echo "🧹 Cleaning up processes..."
    pkill -f "uvicorn"
    pkill -f "vite"
    exit 0
}

# Setup trap for cleanup
trap cleanup INT TERM

# Check dependencies
echo "📋 Checking dependencies..."

if ! command_exists python3; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# Setup backend
echo "⚙️ Setting up backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install backend dependencies
echo "📦 Installing backend dependencies..."
pip install -r requirements.txt || pip install fastapi uvicorn python-multipart

# Create temp directories
mkdir -p temp_projects

# Start backend server
echo "🚀 Starting backend server..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Setup frontend
echo "⚙️ Setting up frontend..."
cd ../frontend

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Start frontend development server
echo "🚀 Starting frontend development server..."
npm run dev &
FRONTEND_PID=$!

# Wait for servers to start
echo "⏳ Waiting for servers to start..."
sleep 5

echo "✅ Development environment is ready!"
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait $BACKEND_PID $FRONTEND_PID
