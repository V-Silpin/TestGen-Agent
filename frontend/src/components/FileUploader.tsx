import React, { useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { UploadResponse } from '../types/project';

interface FileUploaderProps {
    onUploadSuccess: (response: UploadResponse) => void;
    onError: (error: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess, onError }) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const cppFileExtensions = ['.cpp', '.hpp', '.h', '.cc', '.cxx', '.c++'];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            addFiles(Array.from(files));
        }
    };

    const addFiles = (files: File[]) => {
        const validFiles = files.filter(file => 
            cppFileExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        );
        
        if (validFiles.length === 0) {
            onError('Please select C++ files (.cpp, .hpp, .h, .cc, .cxx, .c++)');
            return;
        }

        setSelectedFiles(prev => [...prev, ...validFiles]);
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
        if (selectedFiles.length === 0) {
            onError('Please select at least one C++ file');
            return;
        }

        setUploading(true);
        try {
            const fileList = new DataTransfer();
            selectedFiles.forEach(file => fileList.items.add(file));
            
            const response = await ApiService.uploadProject(fileList.files);
            onUploadSuccess(response);
            setSelectedFiles([]);
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload C++ Project</h2>
                <p className="text-gray-600">
                    Upload your C++ source files to generate unit tests
                </p>
            </div>

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

            {selectedFiles.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                        Selected Files ({selectedFiles.length})
                    </h3>
                    <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center">
                                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
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

            {selectedFiles.length > 0 && (
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
                            'Upload Project'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileUploader;