from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
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
import zipfile
import tarfile
import requests
from io import BytesIO
import json

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
    try:
        project_id = str(uuid.uuid4())
        # Use absolute path to ensure we're in the right directory
        base_path = Path(__file__).parent / "temp_projects"
        project_path = base_path / project_id
        project_path.mkdir(parents=True, exist_ok=True)
        
        cpp_files = []
        for file in files:
            if file.filename and file.filename.endswith(('.cpp', '.hpp', '.h', '.cc', '.cxx')):
                file_path = project_path / file.filename
                with open(file_path, "wb") as f:
                    content = await file.read()
                    f.write(content)
                cpp_files.append(str(file_path))
        
        if not cpp_files:
            raise HTTPException(status_code=400, detail="No C++ files found")
        
        print(f"Uploaded files to: {project_path}")
        print(f"C++ files: {cpp_files}")
        
        # Analyze project structure
        project_info = await test_generator.analyze_project(project_path)
        
        active_projects[project_id] = {
            "path": project_path,
            "files": cpp_files,
            "info": project_info
        }
        
        return {"project_id": project_id, "files": cpp_files, "info": project_info}
    
    except Exception as e:
        print(f"Error in upload_project: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

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

@app.get("/api/system-requirements")
async def check_system_requirements():
    """Check if required build tools are available"""
    requirements = test_generator.check_system_requirements()
    return {
        "requirements": requirements,
        "all_available": all(requirements.values()),
        "missing_tools": [tool for tool, available in requirements.items() if not available]
    }

@app.post("/api/upload-github", status_code=201)
async def upload_github(request: Request):
    """Upload project to GitHub repository"""
    try:
        data = await request.json()
        repo_url = data.get("repo_url")
        access_token = data.get("access_token")
        project_id = data.get("project_id")
        
        if not all([repo_url, access_token, project_id]):
            raise HTTPException(status_code=400, detail="Missing fields in request")
        
        if project_id not in active_projects:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = active_projects[project_id]
        project_path = project["path"]
        
        # Create a zip file of the project
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file in project["files"]:
                zip_file.write(file, arcname=os.path.basename(file))
        
        zip_buffer.seek(0)
        
        # Upload to GitHub
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # Create a release on GitHub
        release_response = requests.post(
            f"{repo_url}/releases",
            headers=headers,
            json={"tag_name": project_id, "name": f"Release {project_id}", "body": "Automated release"}
        )
        
        release_response.raise_for_status()
        upload_url = release_response.json()["upload_url"].split("{")[0]
        
        # Upload the zip file
        upload_response = requests.put(
            f"{upload_url}?name={project_id}.zip",
            headers=headers,
            data=zip_buffer.getvalue()
        )
        
        upload_response.raise_for_status()
        
        return {"message": "Project uploaded to GitHub", "project_id": project_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-zip", status_code=201)
async def upload_zip(file: UploadFile = File(...)):
    """Upload a zip file containing the project"""
    try:
        project_id = str(uuid.uuid4())
        # Use absolute path to ensure we're in the right directory
        base_path = Path(__file__).parent / "temp_projects"
        project_path = base_path / project_id
        project_path.mkdir(parents=True, exist_ok=True)
        
        # Save the uploaded zip file
        zip_path = project_path / file.filename
        with open(zip_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Extract the zip file
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(project_path)
        
        # Get the list of extracted files
        extracted_files = [f for f in project_path.rglob("*") if f.is_file()]
        cpp_files = [str(f) for f in extracted_files if f.suffix in ['.cpp', '.hpp', '.h', '.cc', '.cxx']]
        
        if not cpp_files:
            raise HTTPException(status_code=400, detail="No C++ files found in the zip")
        
        print(f"Uploaded and extracted files to: {project_path}")
        print(f"C++ files: {cpp_files}")
        
        # Analyze project structure
        project_info = await test_generator.analyze_project(project_path)
        
        active_projects[project_id] = {
            "path": project_path,
            "files": cpp_files,
            "info": project_info
        }
        
        return {"project_id": project_id, "files": cpp_files, "info": project_info}
    
    except Exception as e:
        print(f"Error in upload_zip: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# Schema for GitHub upload request
class GitHubUploadRequest(BaseModel):
    github_url: str

@app.post("/api/upload-from-github")
async def upload_from_github(request: GitHubUploadRequest):
    """Upload C++ project from GitHub repository"""
    try:
        github_url = request.github_url.strip()
        
        # Extract owner and repo from GitHub URL
        if not github_url.startswith('https://github.com/'):
            raise HTTPException(status_code=400, detail="Invalid GitHub URL format")
        
        # Remove .git suffix if present
        if github_url.endswith('.git'):
            github_url = github_url[:-4]
        
        # Extract owner/repo from URL
        parts = github_url.replace('https://github.com/', '').split('/')
        if len(parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid GitHub URL format")
        
        owner, repo = parts[0], parts[1]
        
        # Download repository as zip
        download_url = f"https://api.github.com/repos/{owner}/{repo}/zipball"
        
        project_id = str(uuid.uuid4())
        base_path = Path(__file__).parent / "temp_projects"
        project_path = base_path / project_id
        project_path.mkdir(parents=True, exist_ok=True)
        
        # Download the repository
        response = requests.get(download_url, timeout=30)
        response.raise_for_status()
        
        # Extract zip file
        with zipfile.ZipFile(BytesIO(response.content)) as zip_file:
            zip_file.extractall(project_path)
        
        # Find C++ files recursively
        cpp_files = []
        for file_path in project_path.rglob('*'):
            if file_path.is_file() and file_path.suffix in ['.cpp', '.hpp', '.h', '.cc', '.cxx', '.c++']:
                cpp_files.append(str(file_path))
        
        if not cpp_files:
            raise HTTPException(status_code=400, detail="No C++ files found in repository")
        
        # Analyze project structure
        project_info = await test_generator.analyze_project(project_path)
        
        active_projects[project_id] = {
            "path": project_path,
            "files": cpp_files,
            "info": project_info
        }
        
        return {"project_id": project_id, "files": cpp_files, "info": project_info}
    
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to download repository: {str(e)}")
    except Exception as e:
        print(f"Error in upload_from_github: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/upload-zip-project")
async def upload_zip_project(zip_file: UploadFile = File(...)):
    """Upload C++ project from zip/tar.gz file"""
    try:
        project_id = str(uuid.uuid4())
        base_path = Path(__file__).parent / "temp_projects"
        project_path = base_path / project_id
        project_path.mkdir(parents=True, exist_ok=True)
        
        # Read the uploaded file
        content = await zip_file.read()
        
        # Extract based on file extension
        if zip_file.filename.endswith('.zip'):
            with zipfile.ZipFile(BytesIO(content)) as archive:
                archive.extractall(project_path)
        elif zip_file.filename.endswith(('.tar.gz', '.tgz')):
            with tarfile.open(fileobj=BytesIO(content), mode='r:gz') as archive:
                archive.extractall(project_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported archive format")
        
        # Find C++ files recursively
        cpp_files = []
        for file_path in project_path.rglob('*'):
            if file_path.is_file() and file_path.suffix in ['.cpp', '.hpp', '.h', '.cc', '.cxx', '.c++']:
                cpp_files.append(str(file_path))
        
        if not cpp_files:
            raise HTTPException(status_code=400, detail="No C++ files found in archive")
        
        # Analyze project structure
        project_info = await test_generator.analyze_project(project_path)
        
        active_projects[project_id] = {
            "path": project_path,
            "files": cpp_files,
            "info": project_info
        }
        
        return {"project_id": project_id, "files": cpp_files, "info": project_info}
    
    except Exception as e:
        print(f"Error in upload_zip_project: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
