import yaml
from typing import Dict, Any, Optional, List
from pathlib import Path
import os
from langchain.schema import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict, Annotated

from dotenv import load_dotenv

# State for LangGraph workflow
class TestGenerationState(TypedDict):
    source_code: Dict[str, str]
    framework: str
    instructions: Dict[str, Any]
    generated_tests: Dict[str, str]
    build_logs: List[str]
    iteration_count: int
    messages: Annotated[List[HumanMessage | SystemMessage], add_messages]

class LLMService:
    def __init__(self):
        # Initialize GitHub Models (using OpenAI API format)
        load_dotenv()
        self.github_api_key = os.getenv("GITHUB_TOKEN")
        self.github_base_url = os.getenv("ENDPOINT")
        self.model = os.getenv("MODEL_NAME")
        
        # Validate required environment variables
        if not self.model:
            raise ValueError("MODEL_NAME environment variable is required")
        if not self.github_api_key:
            raise ValueError("GITHUB_TOKEN environment variable is required")
        if not self.github_base_url:
            raise ValueError("ENDPOINT environment variable is required")
        
        # Initialize LangChain LLM with GitHub Models
        self.llm = ChatOpenAI(
            model=self.model,  # GitHub Models available model
            api_key=self.github_api_key,
            base_url=self.github_base_url,
            temperature=0.1,
            max_tokens=4000,
        )
        
        # Initialize output parser
        self.output_parser = StrOutputParser()
        
        # Create the LangGraph workflow
        self.workflow = self._create_workflow()
        
        self.prompts_dir = Path("prompts")
        self.prompts_dir.mkdir(exist_ok=True)
        
        # Load YAML instruction templates
        self.load_instruction_templates()
    
    def _create_workflow(self) -> StateGraph:
        """Create LangGraph workflow for test generation"""
        workflow = StateGraph(TestGenerationState)
        
        # Add nodes
        workflow.add_node("generate_initial_tests", self._generate_initial_tests_node)
        workflow.add_node("refine_tests", self._refine_tests_node)
        workflow.add_node("fix_build_issues", self._fix_build_issues_node)
        
        # Add edges
        workflow.add_edge(START, "generate_initial_tests")
        workflow.add_edge("generate_initial_tests", "refine_tests")
        workflow.add_edge("refine_tests", END)
        workflow.add_edge("fix_build_issues", "refine_tests")
        
        return workflow.compile()
    
    async def _generate_initial_tests_node(self, state: TestGenerationState) -> TestGenerationState:
        """Node for generating initial tests"""
        # Create prompt template
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", """You are an expert C++ developer specializing in unit testing. 
            Generate high-quality, comprehensive unit tests following best practices.
            
            Instructions: {instructions}
            
            Generate tests for the provided C++ code following these requirements:
            - Use {framework} testing framework
            - Include edge cases and boundary conditions
            - Create tests for both success and failure scenarios
            - Follow C++ testing best practices
            - Include necessary headers and dependencies
            
            Return the tests in the following format:
            ===TEST_FILE_START===
            filename: test_[source_filename].cpp
            content: [test code here]
            ===TEST_FILE_END===
            """),
            ("human", "SOURCE CODE:\n{source_code}")
        ])
        
        # Format source code
        formatted_source = self._format_source_code(state["source_code"])
        
        # Create chain
        chain = prompt_template | self.llm | self.output_parser
        
        # Generate response
        response = await chain.ainvoke({
            "instructions": yaml.dump(state["instructions"], default_flow_style=False),
            "framework": state["framework"],
            "source_code": formatted_source
        })
        
        # Parse response
        test_files = self._parse_test_response(response)
        
        # Update state
        state["generated_tests"] = test_files["tests"]
        state["messages"] = [
            SystemMessage(content="Generated initial unit tests"),
            HumanMessage(content=f"Generated {len(test_files['tests'])} test files")
        ]
        
        return state
    
    async def _refine_tests_node(self, state: TestGenerationState) -> TestGenerationState:
        """Node for refining tests"""
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", """You are a senior code reviewer specializing in C++ testing. 
            Improve the quality and correctness of the provided tests.
            
            Instructions: {instructions}
            
            Focus on:
            1. Removing duplicates
            2. Adding missing includes
            3. Improving test quality
            4. Fixing any issues
            
            Return the refined tests in the same format as the input.
            """),
            ("human", "EXISTING TESTS:\n{test_files}\n\nBUILD LOGS:\n{build_logs}")
        ])
        
        # Format test files
        formatted_tests = self._format_test_files(state["generated_tests"])
        
        # Create chain
        chain = prompt_template | self.llm | self.output_parser
        
        # Generate response
        response = await chain.ainvoke({
            "instructions": yaml.dump(state["instructions"], default_flow_style=False),
            "test_files": formatted_tests,
            "build_logs": "\n".join(state.get("build_logs", []))
        })
        
        # Parse response
        refined_tests = self._parse_test_response(response)
        
        # Update state
        state["generated_tests"] = refined_tests["tests"]
        state["messages"].extend([
            SystemMessage(content="Refined unit tests"),
            HumanMessage(content=f"Refined {len(refined_tests['tests'])} test files")
        ])
        
        return state
    
    async def _fix_build_issues_node(self, state: TestGenerationState) -> TestGenerationState:
        """Node for fixing build issues"""
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", """You are a C++ build engineer. Fix compilation errors while maintaining test functionality.
            
            Instructions: {instructions}
            
            Analyze the build logs and fix:
            - Syntax errors and missing includes
            - Linking issues and library dependencies
            - Ensure compatibility with C++17 standard
            - Maintain test functionality while fixing issues
            
            Return the corrected test files.
            """),
            ("human", """SOURCE FILES:
{source_files}

TEST FILES:
{test_files}

BUILD LOGS:
{build_logs}

Fix the compilation errors and issues. Return the corrected test files.""")
        ])
        
        # Format files
        formatted_source = self._format_source_code(state["source_code"])
        formatted_tests = self._format_test_files(state["generated_tests"])
        
        # Create chain
        chain = prompt_template | self.llm | self.output_parser
        
        # Generate response
        response = await chain.ainvoke({
            "instructions": yaml.dump(state["instructions"], default_flow_style=False),
            "source_files": formatted_source,
            "test_files": formatted_tests,
            "build_logs": "\n".join(state["build_logs"])
        })
        
        # Parse response
        fixed_tests = self._parse_test_response(response)
        
        # Update state
        state["generated_tests"] = fixed_tests["tests"]
        state["iteration_count"] = state.get("iteration_count", 0) + 1
        state["messages"].extend([
            SystemMessage(content="Fixed build issues"),
            HumanMessage(content=f"Fixed {len(fixed_tests['tests'])} test files")
        ])
        
        return state
    
    def load_instruction_templates(self):
        """Load YAML instruction templates for different stages"""
        self.instructions = {}
        
        # Initial test generation instructions
        self.instructions["initial_generation"] = {
            "role": "expert_cpp_tester",
            "task": "generate_unit_tests",
            "requirements": [
                "Generate comprehensive unit tests for all public functions",
                "Use the specified testing framework (Google Test, Catch2, or doctest)",
                "Include edge cases and boundary conditions",
                "Create tests for both success and failure scenarios",
                "Follow C++ testing best practices",
                "Include necessary headers and dependencies"
            ],
            "output_format": "cpp_test_files",
            "coverage_target": 0.8
        }
        
        # Test refinement instructions
        self.instructions["refinement"] = {
            "role": "code_reviewer",
            "task": "refine_unit_tests",
            "requirements": [
                "Remove duplicate test cases",
                "Add missing library includes",
                "Improve test assertions and error messages",
                "Optimize test structure and readability",
                "Ensure proper test isolation",
                "Add missing test cases for uncovered code paths"
            ],
            "output_format": "improved_cpp_tests"
        }
        
        # Build fix instructions
        self.instructions["build_fix"] = {
            "role": "build_engineer",
            "task": "fix_compilation_errors",
            "requirements": [
                "Analyze compilation errors and warnings",
                "Fix syntax errors and missing includes",
                "Resolve linking issues",
                "Ensure compatibility with the target C++ standard",
                "Maintain test functionality while fixing issues"
            ],
            "output_format": "fixed_cpp_code"
        }
    
    async def call_ollama(self, model: str, prompt: str, system_prompt: str = None) -> str:
        """Call GitHub Models API via LangChain (deprecated, use workflow instead)"""
        # This method is kept for backward compatibility but should use the workflow
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))
        
        response = await self.llm.ainvoke(messages)
        return response.content
    
    async def generate_initial_tests(self, cpp_files: List[str], framework: str = "google_test") -> Dict[str, Any]:
        """Generate initial unit tests for C++ files using LangGraph workflow"""
        
        # Read C++ source files
        source_code = {}
        for file_path in cpp_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                source_code[file_path] = f.read()
        
        # Create initial state
        initial_state = TestGenerationState(
            source_code=source_code,
            framework=framework,
            instructions=self.instructions["initial_generation"],
            generated_tests={},
            build_logs=[],
            iteration_count=0,
            messages=[]
        )
        
        # Run the workflow
        result = await self.workflow.ainvoke(initial_state)
        
        return {"tests": result["generated_tests"]}
    
    async def refine_tests(self, test_files: Dict[str, str], build_logs: List[str] = None) -> Dict[str, Any]:
        """Refine existing tests using LangGraph workflow"""
        
        # Create state for refinement
        state = TestGenerationState(
            source_code={},
            framework="google_test",
            instructions=self.instructions["refinement"],
            generated_tests=test_files,
            build_logs=build_logs or [],
            iteration_count=0,
            messages=[]
        )
        
        # Run refinement node directly
        result = await self._refine_tests_node(state)
        
        return {"tests": result["generated_tests"]}
    
    async def fix_build_issues(self, source_files: Dict[str, str], test_files: Dict[str, str], build_logs: List[str]) -> Dict[str, Any]:
        """Fix compilation and build issues using LangGraph workflow"""
        
        # Create state for build fixing
        state = TestGenerationState(
            source_code=source_files,
            framework="google_test",
            instructions=self.instructions["build_fix"],
            generated_tests=test_files,
            build_logs=build_logs,
            iteration_count=0,
            messages=[]
        )
        
        # Run build fix node directly
        result = await self._fix_build_issues_node(state)
        
        return {"tests": result["generated_tests"]}
    
    async def run_complete_workflow(self, cpp_files: List[str], framework: str = "google_test") -> Dict[str, Any]:
        """Run the complete test generation workflow"""
        
        # Read C++ source files
        source_code = {}
        for file_path in cpp_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                source_code[file_path] = f.read()
        
        # Create initial state
        initial_state = TestGenerationState(
            source_code=source_code,
            framework=framework,
            instructions=self.instructions["initial_generation"],
            generated_tests={},
            build_logs=[],
            iteration_count=0,
            messages=[]
        )
        
        # Run the complete workflow
        result = await self.workflow.ainvoke(initial_state)
        
        return {
            "tests": result["generated_tests"],
            "messages": result["messages"],
            "iteration_count": result["iteration_count"]
        }
    
    def _format_source_code(self, source_code: Dict[str, str]) -> str:
        """Format source code for prompt"""
        formatted = []
        for file_path, content in source_code.items():
            formatted.append(f"=== {file_path} ===")
            formatted.append(content)
            formatted.append("")
        return "\n".join(formatted)
    
    def _format_test_files(self, test_files: Dict[str, str]) -> str:
        """Format test files for prompt"""
        formatted = []
        for filename, content in test_files.items():
            formatted.append(f"=== {filename} ===")
            formatted.append(content)
            formatted.append("")
        return "\n".join(formatted)
    
    def _parse_test_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response to extract test files"""
        test_files = {}
        
        # Split response by test file markers
        parts = response.split("===TEST_FILE_START===")
        
        for part in parts[1:]:  # Skip first empty part
            if "===TEST_FILE_END===" in part:
                content = part.split("===TEST_FILE_END===")[0].strip()
                lines = content.split('\n')
                
                filename = None
                test_content = []
                
                for line in lines:
                    if line.startswith("filename:"):
                        filename = line.split("filename:")[1].strip()
                    elif line.startswith("content:"):
                        test_content.append(line.split("content:")[1].strip())
                    elif filename and not line.startswith("filename:"):
                        test_content.append(line)
                
                if filename and test_content:
                    test_files[filename] = "\n".join(test_content)
        
        return {"tests": test_files}
    
    async def check_llm_connection(self) -> bool:
        """Check if GitHub Models API is accessible"""
        try:
            # Test with a simple message
            test_message = HumanMessage(content="Hello, test connection")
            response = await self.llm.ainvoke([test_message])
            return response.content is not None
        except Exception as e:
            print(f"LLM connection failed: {e}")
            return False
