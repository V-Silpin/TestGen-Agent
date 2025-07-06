import React, { useState } from 'react';
import { CheckCircle, XCircle, FileText, BarChart3, AlertCircle, ChevronDown, ChevronRight, Download } from 'lucide-react';
import type { TestGenerationResponse } from '../types/project';

interface TestResultsProps {
    results: TestGenerationResponse;
    onDownload: () => void;
}

const TestResults: React.FC<TestResultsProps> = ({ results, onDownload }) => {
    const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'tests' | 'coverage' | 'logs'>('tests');

    const toggleTestExpansion = (filename: string) => {
        setExpandedTests(prev => {
            const newSet = new Set(prev);
            if (newSet.has(filename)) {
                newSet.delete(filename);
            } else {
                newSet.add(filename);
            }
            return newSet;
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="h-6 w-6 text-green-500" />;
            case 'error':
                return <XCircle className="h-6 w-6 text-red-500" />;
            default:
                return <AlertCircle className="h-6 w-6 text-yellow-500" />;
        }
    };

    const getLogLevelColor = (level: string) => {
        switch (level) {
            case 'error':
                return 'text-red-600 bg-red-50';
            case 'warning':
                return 'text-yellow-600 bg-yellow-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            {getStatusIcon(results.status)}
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Test Generation Results
                                </h2>
                                <p className="text-gray-600">
                                    Project ID: {results.project_id}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onDownload}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download Tests
                        </button>
                    </div>
                </div>

                {results.error && (
                    <div className="p-4 bg-red-50 border-l-4 border-red-400">
                        <div className="flex">
                            <XCircle className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Error</h3>
                                <p className="mt-1 text-sm text-red-700">{results.error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('tests')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'tests'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <FileText className="h-4 w-4 inline mr-2" />
                            Tests ({results.generated_tests.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('coverage')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'coverage'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <BarChart3 className="h-4 w-4 inline mr-2" />
                            Coverage
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'logs'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            Logs ({results.build_logs.length})
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'tests' && (
                        <div className="space-y-4">
                            {results.generated_tests.map((test, index) => (
                                <div key={index} className="border rounded-lg">
                                    <div
                                        className="p-4 cursor-pointer hover:bg-gray-50"
                                        onClick={() => toggleTestExpansion(test.filename)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                {expandedTests.has(test.filename) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                                <FileText className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <h3 className="font-medium text-gray-900">{test.filename}</h3>
                                                    <p className="text-sm text-gray-600">
                                                        Source: {test.source_file} | Coverage: {(test.coverage_estimate * 100).toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {test.functions_tested.map((func, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded"
                                                    >
                                                        {func}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {expandedTests.has(test.filename) && (
                                        <div className="border-t p-4 bg-gray-50">
                                            <pre className="text-sm text-gray-800 overflow-x-auto">
                                                {test.content}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'coverage' && results.coverage_report && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-blue-900">Overall Coverage</h3>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {(results.coverage_report.overall_coverage * 100).toFixed(1)}%
                                    </p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-green-900">Lines Covered</h3>
                                    <p className="text-2xl font-bold text-green-600">
                                        {results.coverage_report.lines_covered} / {results.coverage_report.total_lines}
                                    </p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-purple-900">Functions</h3>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {Object.keys(results.coverage_report.function_coverage).length}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">File Coverage</h3>
                                {Object.entries(results.coverage_report.file_coverage).map(([file, coverage]) => (
                                    <div key={file} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                        <span className="text-sm font-medium text-gray-900">{file}</span>
                                        <span className="text-sm text-gray-600">{(coverage * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="space-y-2">
                            {results.build_logs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-lg text-sm ${getLogLevelColor(log.level)}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="font-medium uppercase">{log.level}</span>
                                            {log.file && (
                                                <span className="ml-2 text-gray-600">
                                                    {log.file}
                                                    {log.line && `:${log.line}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="mt-1">{log.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TestResults;
