import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import FileUploader from './components/FileUploader';
import ProjectInput from './components/ProjectInput';
import TestResults from './components/TestResults';
import type { UploadResponse, TestGenerationResponse } from './types/project';
import './App.css';

interface Alert {
  type: 'error' | 'success' | 'info';
  message: string;
}

function App() {
  const [currentProject, setCurrentProject] = useState<UploadResponse | null>(null);
  const [testResults, setTestResults] = useState<TestGenerationResponse | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  const showAlert = (type: Alert['type'], message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleUploadSuccess = (response: UploadResponse) => {
    setCurrentProject(response);
    setTestResults(null);
    showAlert('success', 'Project uploaded successfully!');
  };

  const handleUploadError = (error: string) => {
    showAlert('error', error);
  };

  const handleTestGenerated = (response: TestGenerationResponse) => {
    setTestResults(response);
    if (response.status === 'success') {
      showAlert('success', 'Tests generated successfully!');
    } else {
      showAlert('error', response.error || 'Test generation failed');
    }
  };

  const handleTestGenerationError = (error: string) => {
    showAlert('error', error);
  };

  const handleProjectDeleted = () => {
    setCurrentProject(null);
    setTestResults(null);
    showAlert('info', 'Project deleted successfully');
  };

  const handleDownloadTests = async () => {
    if (!currentProject) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/download-tests/${currentProject.project_id}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated_tests.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      showAlert('error', 'Failed to download tests');
    }
  };

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            C++ Test Generator
          </h1>
          <p className="text-xl text-gray-600">
            Generate comprehensive unit tests for your C++ projects using AI
          </p>
        </div>

        {alert && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg border ${getAlertStyles(alert.type)} shadow-lg z-50`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">{alert.message}</span>
              </div>
              <button
                onClick={() => setAlert(null)}
                className="ml-4 p-1 hover:bg-opacity-20 hover:bg-gray-600 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {!currentProject ? (
            <FileUploader
              onUploadSuccess={handleUploadSuccess}
              onError={handleUploadError}
            />
          ) : (
            <div className="space-y-8">
              <ProjectInput
                projectData={currentProject}
                onTestGenerated={handleTestGenerated}
                onError={handleTestGenerationError}
                onProjectDeleted={handleProjectDeleted}
              />
              
              {testResults && (
                <TestResults
                  results={testResults}
                  onDownload={handleDownloadTests}
                />
              )}
            </div>
          )}
        </div>

        <footer className="mt-12 text-center text-gray-500">
          <p>&copy; 2025 C++ Test Generator. Built with React and FastAPI.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
