import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Github, Archive, Link } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { UploadResponse } from '../types/project';

interface FileUploaderProps {
    onUploadSuccess: (response: UploadResponse) => void;
    onError: (error: string) => void;
}

type UploadMode = 'files' | 'github' | 'zip';

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess, onError }) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [uploadMode, setUploadMode] = useState<UploadMode>('github');
    const [githubUrl, setGithubUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);

    const cppFileExtensions = ['.cpp', '.hpp', '.h', '.cc', '.cxx', '.c++'];
    const zipFileExtensions = ['.zip', '.tar.gz', '.tgz'];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            addFiles(Array.from(files));
        }
    };

    const handleZipFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (zipFileExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
                setSelectedFiles([file]);
            } else {
                onError('Please select a valid archive file (.zip, .tar.gz, .tgz)');
            }
        }
    };

    const addFiles = (files: File[]) => {
        if (uploadMode === 'zip') {
            const zipFile = files.find(file => 
                zipFileExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
            );
            if (zipFile) {
                setSelectedFiles([zipFile]);
            } else {
                onError('Please select a valid archive file (.zip, .tar.gz, .tgz)');
            }
            return;
        }

        const validFiles = files.filter(file => 
            cppFileExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        );
        
        if (validFiles.length === 0) {
            onError('Please select C++ files (.cpp, .hpp, .h, .cc, .cxx, .c++)');
            return;
        }

        setSelectedFiles(prev => [...prev, ...validFiles]);
    };

    const handleModeSwitch = (mode: UploadMode) => {
        setUploadMode(mode);
        setSelectedFiles([]);
        setGithubUrl('');
    };

    const validateGithubUrl = (url: string): boolean => {
        const githubRegex = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
        return githubRegex.test(url);
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
        
        const files = Array.from(event.dataTransfer.files);
        addFiles(files);
    };

    const handleUpload = async () => {
        if (uploadMode === 'github') {
            if (!githubUrl.trim()) {
                onError('Please enter a GitHub repository URL');
                return;
            }
            
            if (!validateGithubUrl(githubUrl)) {
                onError('Please enter a valid GitHub repository URL (e.g., https://github.com/user/repo)');
                return;
            }

            setUploading(true);
            try {
                const response = await ApiService.uploadFromGithub(githubUrl);
                onUploadSuccess(response);
                setGithubUrl('');
            } catch (error) {
                onError(error instanceof Error ? error.message : 'Failed to fetch from GitHub');
            } finally {
                setUploading(false);
            }
        } else {
            if (selectedFiles.length === 0) {
                onError(`Please select at least one ${uploadMode === 'zip' ? 'archive' : 'C++ file'}`);
                return;
            }

            setUploading(true);
            try {
                const fileList = new DataTransfer();
                selectedFiles.forEach(file => fileList.items.add(file));
                
                const response = uploadMode === 'zip' 
                    ? await ApiService.uploadZipProject(fileList.files)
                    : await ApiService.uploadProject(fileList.files);
                    
                onUploadSuccess(response);
                setSelectedFiles([]);
            } catch (error) {
                onError(error instanceof Error ? error.message : 'Upload failed');
            } finally {
                setUploading(false);
            }
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload C++ Project</h2>
                <p className="text-gray-600">
                    Upload your C++ project from GitHub, as a zip file, or select individual files
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => handleModeSwitch('github')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                            uploadMode === 'github'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <Github className="h-4 w-4 mr-2 inline" />
                        GitHub Repository
                    </button>
                    <button
                        onClick={() => handleModeSwitch('zip')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                            uploadMode === 'zip'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <Archive className="h-4 w-4 mr-2 inline" />
                        Archive File
                    </button>
                    <button
                        onClick={() => handleModeSwitch('files')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                            uploadMode === 'files'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <FileText className="h-4 w-4 mr-2 inline" />
                        Individual Files
                    </button>
                </nav>
            </div>

            {/* GitHub URL Input */}
            {uploadMode === 'github' && (
                <div className="mb-6">
                    <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 mb-2">
                        GitHub Repository URL
                    </label>
                    <div className="flex space-x-2">
                        <div className="flex-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Link className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="github-url"
                                type="url"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                placeholder="https://github.com/username/repository"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !githubUrl.trim()}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Fetching...
                                </>
                            ) : (
                                <>
                                    <Github className="h-4 w-4 mr-2" />
                                    Fetch Repository
                                </>
                            )}
                        </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        Enter a public GitHub repository URL containing C++ code
                    </p>
                </div>
            )}

            {/* Archive File Upload */}
            {uploadMode === 'zip' && (
                <div>
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            dragOver 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Archive className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-lg text-gray-600 mb-2">
                            Drag and drop an archive file here, or click to select
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            Supported formats: .zip, .tar.gz, .tgz
                        </p>
                        <button
                            onClick={() => zipInputRef.current?.click()}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Select Archive
                        </button>
                        <input
                            ref={zipInputRef}
                            type="file"
                            accept=".zip,.tar.gz,.tgz"
                            onChange={handleZipFileChange}
                            className="hidden"
                        />
                    </div>
                </div>
            )}

            {/* Individual Files Upload */}
            {uploadMode === 'files' && (
                <div>
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            dragOver 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-lg text-gray-600 mb-2">
                            Drag and drop C++ files here, or click to select
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                            Supported formats: .cpp, .hpp, .h, .cc, .cxx, .c++
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Select Files
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".cpp,.hpp,.h,.cc,.cxx,.c++"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                </div>
            )}
            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (uploadMode === 'files' || uploadMode === 'zip') && (
                <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                        Selected {uploadMode === 'zip' ? 'Archive' : 'Files'} ({selectedFiles.length})
                    </h3>
                    <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center">
                                    {uploadMode === 'zip' ? (
                                        <Archive className="h-5 w-5 text-gray-400 mr-3" />
                                    ) : (
                                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                                    )}
                                    <span className="text-sm font-medium text-gray-900">
                                        {file.name}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                >
                                    <X className="h-4 w-4 text-gray-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Button for Files/Archive */}
            {selectedFiles.length > 0 && uploadMode !== 'github' && (
                <div className="mt-6 text-center">
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="h-5 w-5 mr-2" />
                                Upload {uploadMode === 'zip' ? 'Archive' : 'Project'}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileUploader;