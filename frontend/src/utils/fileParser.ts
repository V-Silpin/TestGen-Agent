function parseCppFiles(files) {
    const parsedData = [];

    files.forEach(file => {
        if (file.name.endsWith('.cpp')) {
            const content = file.content; // Assuming content is accessible
            const functions = extractFunctions(content);
            parsedData.push({
                fileName: file.name,
                functions: functions
            });
        }
    });

    return parsedData;
}

function extractFunctions(content) {
    const functionRegex = /(\w+\s+\**\w+\s*\(.*?\)\s*{)/g;
    const matches = content.match(functionRegex);
    return matches ? matches.map(fn => fn.trim()) : [];
}