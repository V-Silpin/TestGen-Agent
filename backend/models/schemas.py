from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from enum import Enum

class TestFramework(str, Enum):
    GOOGLE_TEST = "google_test"
    CATCH2 = "catch2"
    DOCTEST = "doctest"

class LLMModel(str, Enum):
    OLLAMA_LLAMA = "ollama/llama3.2"
    OLLAMA_CODELLAMA = "ollama/codellama"
    GITHUB_COPILOT = "github/copilot"
    OPENAI_GPT4 = "openai/gpt-4"

class TestGenerationRequest(BaseModel):
    llm_model: LLMModel = LLMModel.OLLAMA_LLAMA
    test_framework: TestFramework = TestFramework.GOOGLE_TEST
    coverage_threshold: float = 0.8
    generate_mocks: bool = True
    include_integration_tests: bool = False

class GeneratedTest(BaseModel):
    filename: str
    content: str
    source_file: str
    functions_tested: List[str]
    coverage_estimate: float

class CoverageReport(BaseModel):
    overall_coverage: float
    file_coverage: Dict[str, float]
    function_coverage: Dict[str, float]
    lines_covered: int
    total_lines: int

class BuildLog(BaseModel):
    level: str  # info, warning, error
    message: str
    file: Optional[str] = None
    line: Optional[int] = None

class TestGenerationResponse(BaseModel):
    project_id: str
    status: str
    generated_tests: List[GeneratedTest]
    coverage_report: Optional[CoverageReport] = None
    build_logs: List[BuildLog] = []
    error: Optional[str] = None

class ProjectInfo(BaseModel):
    name: str
    cpp_files: List[str]
    header_files: List[str]
    total_functions: int
    total_classes: int
    complexity_score: float
    dependencies: List[str]
