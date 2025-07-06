# C++ Test Generator - AI-Powered Unit Test Generation

An intelligent test generation tool that creates comprehensive unit tests for C++ projects using AI/LLM models.

## Features

- 🤖 **AI-Powered Test Generation**: Generate tests using multiple LLM models (Ollama, OpenAI, GitHub Copilot)
- 📁 **Multi-File Support**: Upload entire C++ projects with multiple source files
- 🎯 **Multiple Test Frameworks**: Support for Google Test, Catch2, and doctest
- 📊 **Coverage Analysis**: Get detailed coverage reports for generated tests
- 🛠️ **Mock Generation**: Automatic mock object generation for dependencies
- 🔧 **Integration Tests**: Optional integration test generation
- 📈 **Build Logs**: Detailed build information and error reporting
- 🎨 **Modern UI**: Beautiful, responsive React frontend with Tailwind CSS

## Architecture

### Backend (FastAPI)
- **FastAPI**: High-performance API framework
- **Pydantic**: Data validation and settings management
- **Multiple LLM Support**: Integration with various AI models
- **File Processing**: C++ source code analysis and parsing
- **Test Generation**: Intelligent test creation based on code analysis

### Frontend (React + TypeScript)
- **React 19**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icons
- **Axios**: HTTP client for API communication

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

### Option 1: Using Setup Scripts

#### Windows
```bash
# Run the setup script
./dev-setup.bat
```

#### Linux/Mac
```bash
# Make script executable
chmod +x dev-setup.sh

# Run the setup script
./dev-setup.sh
```

### Option 2: Manual Setup

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

### 1. Upload C++ Project

- **Drag & Drop**: Drag your C++ files directly into the upload area
- **File Selection**: Click "Select Files" to browse and select files
- **Supported Extensions**: `.cpp`, `.hpp`, `.h`, `.cc`, `.cxx`, `.c++`

### 2. Configure Test Generation

- **LLM Model**: Choose your preferred AI model
  - Ollama Llama 3.2 (Local)
  - Ollama CodeLlama (Local)
  - GitHub Copilot (API)
  - OpenAI GPT-4 (API)

- **Test Framework**: Select your testing framework
  - Google Test (recommended)
  - Catch2
  - doctest

- **Advanced Options**:
  - Coverage threshold (0-100%)
  - Mock generation (enabled/disabled)
  - Integration tests (enabled/disabled)

### 3. Generate Tests

1. Click "Generate Tests" to start the AI-powered test generation
2. Monitor progress and view build logs
3. Review generated tests in the results panel
4. Download the complete test suite as a ZIP file

### 4. Review Results

- **Generated Tests**: View and expand individual test files
- **Coverage Report**: See detailed coverage metrics
- **Build Logs**: Review compilation and generation logs
- **Download**: Get all tests in a convenient ZIP package

## API Endpoints

### Upload Project
```http
POST /api/upload-project
Content-Type: multipart/form-data

files: C++ source files
```

### Generate Tests
```http
POST /api/generate-tests/{project_id}
Content-Type: application/json

{
  "llm_model": "ollama/llama3.2",
  "test_framework": "google_test",
  "coverage_threshold": 0.8,
  "generate_mocks": true,
  "include_integration_tests": false
}
```

### Download Tests
```http
GET /api/download-tests/{project_id}
```

### Project Status
```http
GET /api/project-status/{project_id}
```

## Configuration

### Backend Configuration

The backend can be configured through environment variables:

```bash
# LLM Service Configuration
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your_openai_api_key
GITHUB_TOKEN=your_github_token

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

### Frontend Configuration

Frontend configuration is handled through the Vite configuration:

```javascript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

## Development

### Backend Development

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Format code
black .

# Lint code
flake8 .
```

### Frontend Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

## Project Structure

```
TestGen-Agent/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   ├── models/
│   │   └── schemas.py         # Pydantic models
│   ├── services/
│   │   ├── llm_service.py     # LLM integration
│   │   └── test_generator.py  # Test generation logic
│   └── prompts/
│       ├── initial_generation.yaml
│       ├── refinement.yaml
│       └── build_fix.yaml
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/         # API services
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   ├── package.json
│   └── vite.config.ts
├── dev-setup.sh             # Linux/Mac setup script
├── dev-setup.bat            # Windows setup script
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for GPT models
- Meta for Llama models
- GitHub for Copilot integration
- The open-source community for testing frameworks

## Support

For support, please open an issue on GitHub or contact the development team.

---

Built with ❤️ using FastAPI, React, and AI
