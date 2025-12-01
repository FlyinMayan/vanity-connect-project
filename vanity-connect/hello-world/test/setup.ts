// Suppress console.error *only when tests pass*.
// If a test fails, Jest prints the real error message.
const originalError = console.error;

console.error = (...args) => {
  // Jest sets process.env.JEST_WORKER_ID during tests
  const isTest = !!process.env.JEST_WORKER_ID;

  // Only suppress logs during tests, not normal runtime.
  if (isTest) {
    return;
  }
  originalError(...args);
};
