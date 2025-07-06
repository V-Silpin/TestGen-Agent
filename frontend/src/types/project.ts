interface ProjectDetails {
    projectName: string;
    mainFile: string;
    includeFiles: string[];
    classNames: string[];
}

interface TestCase {
    description: string;
    input: any;
    expectedOutput: any;
}

interface CppProject {
    details: ProjectDetails;
    testCases: TestCase[];
}