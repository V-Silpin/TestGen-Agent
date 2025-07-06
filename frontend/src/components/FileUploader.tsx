import React, { useState } from 'react';

const FileUploader = ({ onFileUpload }) => {
    const [selectedFile, setSelectedFile] = useState(null);

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (selectedFile) {
            onFileUpload(selectedFile);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input type="file" accept=".cpp" onChange={handleFileChange} />
            <button type="submit">Upload C++ Project</button>
        </form>
    );
};

export default FileUploader;