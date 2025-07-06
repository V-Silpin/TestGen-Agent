import React, { useState } from 'react';

const CodeEditor = () => {
    const [code, setCode] = useState('');

    const handleCodeChange = (event) => {
        setCode(event.target.value);
    };

    return (
        <div>
            <textarea
                value={code}
                onChange={handleCodeChange}
                placeholder="Edit your C++ code here..."
                rows={20}
                cols={80}
            />
        </div>
    );
};

export default CodeEditor;