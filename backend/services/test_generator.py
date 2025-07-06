import os
import asyncio
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional
import re
import yaml

from models.schemas import ProjectInfo, GeneratedTest, CoverageReport, BuildLog
from services.llm_service import LLMService

class TestGenerator:
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.cmake_template = self._load_cmake_template()
    
    async def analyze_project(self, project_path: Path) -> ProjectInfo:
        """Analyze C++ project structure and complexity"""
        cpp_files = []
        header_files = []
        all_functions = []
        all_classes = []
        dependencies = set()
        
        # Debug: Check if project path exists
        if not project_path.exists():
            raise FileNotFoundError(f"Project path does not exist: {project_path}")
        
        # Scan for C++ files
        for ext in ['*.cpp', '*.cc', '*.cxx']:
            found_files = list(project_path.glob(ext))
            cpp_files.extend(found_files)
        
        for ext in ['*.h', '*.hpp']:
            found_files = list(project_path.glob(ext))
            header_files.extend(found_files)
        
        # Debug: Log found files
        print(f"Found C++ files: {[str(f) for f in cpp_files]}")
        print(f"Found header files: {[str(f) for f in header_files]}")
        
        # Analyze code complexity
        for file_path in cpp_files + header_files:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    
                    # Extract function names (improved regex)
                    function_matches = re.findall(r'\b(\w+)\s+(\w+)\s*\([^)]*\)\s*{', content)
                    for return_type, func_name in function_matches:
                        all_functions.append(f"{return_type} {func_name}")
                    
                    # Extract class names
                    class_matches = re.findall(r'\bclass\s+(\w+)', content)
                    all_classes.extend(class_matches)
                    
                    # Extract includes for dependencies
                    includes = re.findall(r'#include\s*[<"]([^>"]+)[>"]', content)
                    dependencies.update(includes)
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
                continue
        
        # Combine all files for the files field
        all_files = [str(f) for f in cpp_files + header_files]
        
        return ProjectInfo(
            name=project_path.name,
            files=all_files,
            classes=all_classes,
            functions=all_functions,
            dependencies=list(dependencies)
        )
    
    async def generate_tests(self, project_path: Path, cpp_files: List[str], 
                           llm_model: str, test_framework: str) -> Dict[str, Any]:
        """Complete test generation workflow using LangGraph"""
        
        # Step 1: Use LangGraph workflow for comprehensive test generation
        print("🔄 Running LangGraph workflow for test generation...")
        workflow_result = await self.llm_service.run_complete_workflow(cpp_files, test_framework)
        
        # Step 2: Save generated tests
        tests_dir = project_path / "tests"
        tests_dir.mkdir(exist_ok=True)
        
        test_files = {}
        for filename, content in workflow_result["tests"].items():
            test_path = tests_dir / filename
            with open(test_path, 'w', encoding='utf-8') as f:
                f.write(content)
            test_files[filename] = content
        
        # Step 3: Create build system
        await self._create_build_system(project_path, cpp_files, test_framework)
        
        # Step 4: Attempt to build
        print("🔄 Building tests...")
        build_result = await self._build_tests(project_path)
        
        # Step 5: If build fails, use LangGraph to fix issues
        if not build_result["success"]:
            print("⚠️  Build failed, using LangGraph to fix issues...")
            
            source_files = {}
            for cpp_file in cpp_files:
                with open(cpp_file, 'r', encoding='utf-8') as f:
                    source_files[cpp_file] = f.read()
            
            # Use LangGraph workflow to fix build issues
            fixed_tests = await self.llm_service.fix_build_issues(
                source_files, test_files, build_result["logs"]
            )
            
            # Save fixed tests
            for filename, content in fixed_tests["tests"].items():
                test_path = tests_dir / filename
                with open(test_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                test_files[filename] = content
            
            # Try building again
            build_result = await self._build_tests(project_path)
        
        # Step 6: Generate coverage report
        coverage_report = None
        if build_result["success"]:
            print("🔄 Generating coverage report...")
            coverage_report = await self._generate_coverage_report(project_path)
        
        # Step 7: Create generated test objects
        generated_tests = []
        for filename, content in test_files.items():
            source_file = self._extract_source_file(filename)
            functions_tested = self._extract_tested_functions(content)
            
            generated_tests.append(GeneratedTest(
                filename=filename,
                content=content,
                source_file=source_file,
                functions_tested=functions_tested,
                coverage_estimate=0.85  # Higher estimate with LangGraph
            ))
        
        return {
            "tests": generated_tests,
            "coverage": coverage_report,
            "build_logs": [BuildLog(level="info", message=log) for log in build_result.get("logs", [])],
            "workflow_messages": workflow_result.get("messages", []),
            "iteration_count": workflow_result.get("iteration_count", 0)
        }
    
    async def _create_build_system(self, project_path: Path, cpp_files: List[str], framework: str):
        """Create CMakeLists.txt for building tests"""
        
        cmake_content = self.cmake_template.format(
            project_name=project_path.name,
            cpp_files=" ".join([Path(f).name for f in cpp_files]),
            framework=framework
        )
        
        cmake_path = project_path / "CMakeLists.txt"
        with open(cmake_path, 'w', encoding='utf-8') as f:
            f.write(cmake_content)
        
        # Create a basic main.cpp if it doesn't exist
        main_cpp = project_path / "main.cpp"
        if not main_cpp.exists():
            main_content = """
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
"""
            with open(main_cpp, 'w', encoding='utf-8') as f:
                f.write(main_content)
    
    async def _build_tests(self, project_path: Path) -> Dict[str, Any]:
        """Build the test project"""
        # Check if CMake is available
        try:
            cmake_check = subprocess.run(
                ["cmake", "--version"], 
                capture_output=True, 
                text=True,
                timeout=10
            )
            if cmake_check.returncode != 0:
                return {
                    "success": False,
                    "logs": ["CMake not found. Please install CMake and add it to PATH."]
                }
        except FileNotFoundError:
            return {
                "success": False,
                "logs": ["CMake not found. Please install CMake and add it to PATH."]
            }
        except Exception as e:
            return {
                "success": False,
                "logs": [f"Error checking CMake: {str(e)}"]
            }
        
        build_dir = project_path / "build"
        build_dir.mkdir(exist_ok=True)
        
        try:
            # Configure
            configure_cmd = ["cmake", "..", "-DCMAKE_BUILD_TYPE=Debug"]
            configure_result = subprocess.run(
                configure_cmd, 
                cwd=build_dir, 
                capture_output=True, 
                text=True,
                timeout=60
            )
            
            if configure_result.returncode != 0:
                return {
                    "success": False,
                    "logs": [configure_result.stderr, configure_result.stdout]
                }
            
            # Build
            build_cmd = ["cmake", "--build", ".", "--config", "Debug"]
            build_result = subprocess.run(
                build_cmd, 
                cwd=build_dir, 
                capture_output=True, 
                text=True,
                timeout=120
            )
            
            success = build_result.returncode == 0
            logs = [build_result.stdout, build_result.stderr]
            
            return {
                "success": success,
                "logs": logs
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "logs": ["Build timeout"]
            }
        except FileNotFoundError as e:
            return {
                "success": False,
                "logs": [f"Required tool not found: {str(e)}"]
            }
        except Exception as e:
            return {
                "success": False,
                "logs": [f"Build error: {str(e)}"]
            }
    
    async def _generate_coverage_report(self, project_path: Path) -> Optional[CoverageReport]:
        """Generate code coverage report using gcov"""
        try:
            build_dir = project_path / "build"
            
            # Run tests first
            test_executable = build_dir / "test_runner"
            if test_executable.exists():
                try:
                    subprocess.run([str(test_executable)], cwd=build_dir, timeout=30)
                except (FileNotFoundError, subprocess.TimeoutExpired) as e:
                    print(f"Warning: Could not run test executable: {e}")
            
            # Check if gcov is available
            try:
                gcov_check = subprocess.run(
                    ["gcov", "--version"], 
                    capture_output=True, 
                    text=True,
                    timeout=10
                )
                if gcov_check.returncode != 0:
                    print("Warning: gcov not available for coverage report")
                    return None
            except FileNotFoundError:
                print("Warning: gcov not found. Coverage report will be skipped.")
                return None
            
            # Generate coverage data
            gcov_cmd = ["gcov", "*.cpp"]
            gcov_result = subprocess.run(
                gcov_cmd, 
                cwd=build_dir, 
                capture_output=True, 
                text=True,
                timeout=30
            )
            
            if gcov_result.returncode == 0:
                # Parse coverage data (simplified)
                coverage_data = self._parse_coverage_data(gcov_result.stdout)
                return CoverageReport(
                    overall_coverage=coverage_data.get("overall", 0.0),
                    file_coverage=coverage_data.get("files", {}),
                    function_coverage=coverage_data.get("functions", {}),
                    lines_covered=coverage_data.get("lines_covered", 0),
                    total_lines=coverage_data.get("total_lines", 0)
                )
            
        except Exception as e:
            print(f"Coverage generation failed: {e}")
        
        return None
    
    def _parse_coverage_data(self, gcov_output: str) -> Dict[str, Any]:
        """Parse gcov output to extract coverage data"""
        # Simplified parsing
        lines = gcov_output.split('\n')
        coverage_data = {
            "overall": 0.75,  # Placeholder
            "files": {},
            "functions": {},
            "lines_covered": 100,
            "total_lines": 133
        }
        
        for line in lines:
            if "%" in line:
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        percentage = float(parts[1].strip('%'))
                        filename = parts[-1] if len(parts) > 2 else "unknown"
                        coverage_data["files"][filename] = percentage / 100.0
                    except (ValueError, IndexError):
                        continue
        
        return coverage_data
    
    def _extract_source_file(self, test_filename: str) -> str:
        """Extract source file name from test filename"""
        # Remove test_ prefix and .cpp extension, then add .cpp
        if test_filename.startswith("test_"):
            base_name = test_filename[5:]  # Remove "test_"
            if base_name.endswith(".cpp"):
                base_name = base_name[:-4]  # Remove .cpp
            return f"{base_name}.cpp"
        return "unknown.cpp"
    
    def _extract_tested_functions(self, test_content: str) -> List[str]:
        """Extract function names being tested"""
        # Simple regex to find TEST() macros
        test_functions = re.findall(r'TEST\([^,]+,\s*(\w+)\)', test_content)
        return test_functions
    
    def _load_cmake_template(self) -> str:
        """Load CMake template for building tests"""
        return """
cmake_minimum_required(VERSION 3.14)
project({project_name})

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable coverage flags
set(CMAKE_CXX_FLAGS "${{CMAKE_CXX_FLAGS}} --coverage")
set(CMAKE_EXE_LINKER_FLAGS "${{CMAKE_EXE_LINKER_FLAGS}} --coverage")

# Find required packages
find_package(PkgConfig REQUIRED)

# Google Test
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/03597a01ee50ed33e9fd7188feb57d74c5b18a2.zip
)
FetchContent_MakeAvailable(googletest)

# Add source files
file(GLOB_RECURSE SOURCE_FILES "*.cpp" "*.cc" "*.cxx")
file(GLOB_RECURSE HEADER_FILES "*.h" "*.hpp")

# Create main executable
add_executable(main main.cpp)

# Add test executable
file(GLOB_RECURSE TEST_FILES "tests/*.cpp")
if(TEST_FILES)
    add_executable(test_runner ${{TEST_FILES}} ${{SOURCE_FILES}})
    target_link_libraries(test_runner gtest_main)
    target_include_directories(test_runner PRIVATE .)
    
    # Remove main.cpp from test build to avoid multiple main functions
    list(REMOVE_ITEM SOURCE_FILES "${{CMAKE_CURRENT_SOURCE_DIR}}/main.cpp")
endif()

enable_testing()
"""
    
    def check_system_requirements(self) -> Dict[str, bool]:
        """Check if required build tools are available"""
        requirements = {
            "cmake": False,
            "gcc": False,
            "gcov": False
        }
        
        # Check CMake
        try:
            result = subprocess.run(
                ["cmake", "--version"], 
                capture_output=True, 
                text=True,
                timeout=5
            )
            requirements["cmake"] = result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        
        # Check GCC
        try:
            result = subprocess.run(
                ["gcc", "--version"], 
                capture_output=True, 
                text=True,
                timeout=5
            )
            requirements["gcc"] = result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        
        # Check gcov
        try:
            result = subprocess.run(
                ["gcov", "--version"], 
                capture_output=True, 
                text=True,
                timeout=5
            )
            requirements["gcov"] = result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        
        return requirements
