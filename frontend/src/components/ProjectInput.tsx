import React, { useState } from 'react';

const ProjectInput = () => {
    const [projectDetails, setProjectDetails] = useState('');

    const handleChange = (event) => {
        setProjectDetails(event.target.value);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        // Trigger test generation process with projectDetails
    };

    return (
        <form onSubmit={handleSubmit}>
            <label>
                C++ Project Details:
                <input type="text" value={projectDetails} onChange={handleChange} />
            </label>
            <button type="submit">Generate Tests</button>
        </form>
    );
};

export default ProjectInput;