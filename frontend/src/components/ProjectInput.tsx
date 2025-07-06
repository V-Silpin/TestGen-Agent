import React, { useState } from 'react';
import { Settings, Play, Download, Trash2 } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { TestFramework, LLMModel } from '../types/project';
import type { 
    TestGenerationRequest, 
    TestGenerationResponse, 
    UploadResponse
} from '../types/project';

interface ProjectInputProps {
    projectData: UploadResponse;
    onTestGenerated: (response: TestGenerationResponse) => void;
    onError: (error: string) => void;
    onProjectDeleted: () => void;
}

const ProjectInput: React.FC<ProjectInputProps> = ({ 
    projectData, 
    onTestGenerated, 
    onError, 
    onProjectDeleted 
}) => {
    const [generating, setGenerating] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [testRequest, setTestRequest] = useState<TestGenerationRequest>(() => 
        ApiService.createDefaultTestRequest()
    );

    const handleGenerateTests = async () => {
        setGenerating(true);
        try {
            const response = await ApiService.generateTests(projectData.project_id, testRequest);
            onTestGenerated(response);
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Test generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownloadTests = async () => {
        try {
            const blob = await ApiService.downloadTests(projectData.project_id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'generated_tests.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Download failed');
        }
    };

    const handleDeleteProject = async () => {
        if (window.confirm('Are you sure you want to delete this project?')) {
            try {
                await ApiService.deleteProject(projectData.project_id);
                onProjectDeleted();
            } catch (error) {
                onError(error instanceof Error ? error.message : 'Delete failed');
            }
        }
    };

    const updateTestRequest = (updates: Partial<TestGenerationRequest>) => {
        setTestRequest(prev => ({ ...prev, ...updates }));
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            Project: {projectData.info.name}
                        </h2>
                        <p className="text-gray-600 mt-1">
                            {projectData.files.length} files uploaded
                        </p>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </button>
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Project Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-600 mb-2">Files:</p>
                            <div className="space-y-1">
                                {projectData.files.map((file, index) => (
                                    <span key={index} className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded mr-2 mb-1">
                                        {file.split('/').pop()}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-2">Classes:</p>
                            <div className="space-y-1">
                                {projectData.info.classes.map((className, index) => (
                                    <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2 mb-1">
                                        {className}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {showSettings && (
                    <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Test Generation Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    LLM Model
                                </label>
                                <select
                                    value={testRequest.llm_model}
                                    onChange={(e) => updateTestRequest({ llm_model: e.target.value as LLMModel })}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={LLMModel.OLLAMA_LLAMA}>Ollama Llama 3.2</option>
                                    <option value={LLMModel.OLLAMA_CODELLAMA}>Ollama CodeLlama</option>
                                    <option value={LLMModel.GITHUB_COPILOT}>GitHub Copilot</option>
                                    <option value={LLMModel.OPENAI_GPT4}>OpenAI GPT-4</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Test Framework
                                </label>
                                <select
                                    value={testRequest.test_framework}
                                    onChange={(e) => updateTestRequest({ test_framework: e.target.value as TestFramework })}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={TestFramework.GOOGLE_TEST}>Google Test</option>
                                    <option value={TestFramework.CATCH2}>Catch2</option>
                                    <option value={TestFramework.DOCTEST}>doctest</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Coverage Threshold: {(testRequest.coverage_threshold * 100).toFixed(0)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={testRequest.coverage_threshold}
                                    onChange={(e) => updateTestRequest({ coverage_threshold: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={testRequest.generate_mocks}
                                        onChange={(e) => updateTestRequest({ generate_mocks: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <span className="text-sm text-gray-700">Generate Mocks</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={testRequest.include_integration_tests}
                                        onChange={(e) => updateTestRequest({ include_integration_tests: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <span className="text-sm text-gray-700">Include Integration Tests</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex space-x-4">
                    <button
                        onClick={handleGenerateTests}
                        disabled={generating}
                        className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating Tests...
                            </>
                        ) : (
                            <>
                                <Play className="h-5 w-5 mr-2" />
                                Generate Tests
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleDownloadTests}
                        className="inline-flex items-center px-4 py-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </button>
                    <button
                        onClick={handleDeleteProject}
                        className="inline-flex items-center px-4 py-3 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectInput;