from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import asyncio
import uuid
import shutil
import tempfile
from pathlib import Path

from services.test_generator import TestGenerator
from services.llm_service import LLMService
from models.schemas import TestGenerationRequest, TestGenerationResponse, ProjectInfo

app = FastAPI(title="C++ Unit Test Generator", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
llm_service = LLMService()
test_generator = TestGenerator(llm_service)

# Store for active projects
active_projects = {}

@app.get("/")
async def root():
    return {"message": "C++ Unit Test Generator API"}

@app.post("/api/upload-project")
async def upload_project(files: List[UploadFile] = File(...)):
    """Upload C++ project files"""
    project_id = str(uuid.uuid4())
    project_path = Path(f"temp_projects/{project_id}")
    project_path.mkdir(parents=True, exist_ok=True)
    
    cpp_files = []
    for file in files:
        if file.filename.endswith(('.cpp', '.hpp', '.h', '.cc', '.cxx')):
            file_path = project_path / file.filename
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            cpp_files.append(str(file_path))
    
    if not cpp_files:
        raise HTTPException(status_code=400, detail="No C++ files found")
    
    # Analyze project structure
    project_info = await test_generator.analyze_project(project_path)
    
    active_projects[project_id] = {
        "path": project_path,
        "files": cpp_files,
        "info": project_info
    }
    
    return {"project_id": project_id, "files": cpp_files, "info": project_info}

@app.post("/api/generate-tests/{project_id}")
async def generate_tests(project_id: str, request: TestGenerationRequest):
    """Generate unit tests for the project"""
    if project_id not in active_projects:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = active_projects[project_id]
    
    try:
        result = await test_generator.generate_tests(
            project["path"],
            project["files"],
            request.llm_model,
            request.test_framework
        )
        
        return TestGenerationResponse(
            project_id=project_id,
            status="success",
            generated_tests=result["tests"],
            coverage_report=result.get("coverage"),
            build_logs=result.get("build_logs", [])
        )
    
    except Exception as e:
        return TestGenerationResponse(
            project_id=project_id,
            status="error",
            error=str(e),
            generated_tests=[],
            coverage_report=None,
            build_logs=[]
        )

@app.get("/api/project-status/{project_id}")
async def get_project_status(project_id: str):
    """Get project status and information"""
    if project_id not in active_projects:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = active_projects[project_id]
    return {
        "project_id": project_id,
        "status": "active",
        "files": project["files"],
        "info": project["info"]
    }

@app.get("/api/download-tests/{project_id}")
async def download_tests(project_id: str):
    """Download generated test files"""
    if project_id not in active_projects:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = active_projects[project_id]
    tests_path = project["path"] / "tests"
    
    if not tests_path.exists():
        raise HTTPException(status_code=404, detail="No tests generated yet")
    
    # Create a zip file with all test files
    zip_path = project["path"] / "tests.zip"
    shutil.make_archive(str(zip_path.with_suffix('')), 'zip', str(tests_path))
    
    return FileResponse(
        path=str(zip_path),
        filename="generated_tests.zip",
        media_type="application/zip"
    )

@app.delete("/api/project/{project_id}")
async def delete_project(project_id: str):
    """Clean up project files"""
    if project_id in active_projects:
        project_path = active_projects[project_id]["path"]
        if project_path.exists():
            shutil.rmtree(project_path)
        del active_projects[project_id]
    
    return {"message": "Project cleaned up"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
