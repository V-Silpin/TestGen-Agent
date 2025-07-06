import axios from 'axios';
import type {
    TestGenerationRequest,
    TestGenerationResponse,
    UploadResponse,
    ProjectStatus,
} from '../types/project';
import { TestFramework, LLMModel } from '../types/project';

const API_BASE_URL = 'http://localhost:8000/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export class ApiService {
    static async uploadProject(files: FileList): Promise<UploadResponse> {
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });

        const response = await apiClient.post('/upload-project', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    }

    static async uploadZipProject(files: FileList): Promise<UploadResponse> {
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('zip_file', file);
        });

        const response = await apiClient.post('/upload-zip-project', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    }

    static async uploadFromGithub(githubUrl: string): Promise<UploadResponse> {
        const response = await apiClient.post('/upload-from-github', {
            github_url: githubUrl
        });

        return response.data;
    }

    static async generateTests(
        projectId: string,
        request: TestGenerationRequest
    ): Promise<TestGenerationResponse> {
        const response = await apiClient.post(`/generate-tests/${projectId}`, request);
        return response.data;
    }

    static async getProjectStatus(projectId: string): Promise<ProjectStatus> {
        const response = await apiClient.get(`/project-status/${projectId}`);
        return response.data;
    }

    static async downloadTests(projectId: string): Promise<Blob> {
        const response = await apiClient.get(`/download-tests/${projectId}`, {
            responseType: 'blob',
        });
        return response.data;
    }

    static async deleteProject(projectId: string): Promise<void> {
        await apiClient.delete(`/project/${projectId}`);
    }

    static createDefaultTestRequest(): TestGenerationRequest {
        return {
            llm_model: LLMModel.OLLAMA_LLAMA,
            test_framework: TestFramework.GOOGLE_TEST,
            coverage_threshold: 0.8,
            generate_mocks: true,
            include_integration_tests: false
        };
    }
}
