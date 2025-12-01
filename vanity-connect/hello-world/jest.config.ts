module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  reporters: [
    "default",
    "./jest-reporter.js"
  ]
};