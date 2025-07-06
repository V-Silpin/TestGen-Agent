// Enums matching backend
export const TestFramework = {
    GOOGLE_TEST: "google_test",
    CATCH2: "catch2",
    DOCTEST: "doctest"
} as const;

export type TestFramework = typeof TestFramework[keyof typeof TestFramework];

export const LLMModel = {
    OLLAMA_LLAMA: "ollama/llama3.2",
    OLLAMA_CODELLAMA: "ollama/codellama",
    GITHUB_COPILOT: "github/copilot",
    OPENAI_GPT4: "openai/gpt-4"
} as const;

export type LLMModel = typeof LLMModel[keyof typeof LLMModel];

// Request/Response types
export interface TestGenerationRequest {
    llm_model: LLMModel;
    test_framework: TestFramework;
    coverage_threshold: number;
    generate_mocks: boolean;
    include_integration_tests: boolean;
}

export interface GeneratedTest {
    filename: string;
    content: string;
    source_file: string;
    functions_tested: string[];
    coverage_estimate: number;
}

export interface CoverageReport {
    overall_coverage: number;
    file_coverage: { [key: string]: number };
    function_coverage: { [key: string]: number };
    lines_covered: number;
    total_lines: number;
}

export interface BuildLog {
    level: string;
    message: string;
    file?: string;
    line?: number;
}

export interface TestGenerationResponse {
    project_id: string;
    status: string;
    generated_tests: GeneratedTest[];
    coverage_report?: CoverageReport;
    build_logs: BuildLog[];
    error?: string;
}

export interface ProjectInfo {
    name: string;
    files: string[];
    classes: string[];
    functions: string[];
    dependencies: string[];
}

export interface UploadResponse {
    project_id: string;
    files: string[];
    info: ProjectInfo;
}

export interface ProjectStatus {
    project_id: string;
    status: string;
    files: string[];
    info: ProjectInfo;
}