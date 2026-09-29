import {
  calculateSimilarity,
  findMostSimilarSubmission,
} from "./plagiarismService";

const text1 = `
Java is a programming language.
Java is widely used for backend development.
Spring Boot is a framework for building Java applications.
`;

const text2 = `
Java is a programming language.
Java is widely used for backend development.
Spring Boot is a framework for building Java applications.
`;

const text3 = `
Python is a programming language.
Python is commonly used for data science.
Machine learning can be implemented using Python.
`;

console.log(
  "Similarity between text1 and text2:",
  calculateSimilarity(text1, text2),
  "%"
);

console.log(
  "Similarity between text1 and text3:",
  calculateSimilarity(text1, text3),
  "%"
);

const previousSubmissions = [
  {
    id: "1",
    submissionId: "SUB-001",
    studentEmail: "student1@example.com",
    text: text2,
  },
  {
    id: "2",
    submissionId: "SUB-002",
    studentEmail: "student2@example.com",
    text: text3,
  },
];

const result = findMostSimilarSubmission(
  text1,
  previousSubmissions
);

console.log("Most similar submission:", result);