class CleanReporter {
  onRunComplete(_, results) {
    console.log("\n================ TEST SUMMARY ================");
    results.testResults.forEach(testFile => {
      console.log(`\n📄 ${testFile.testFilePath}`);
      testFile.testResults.forEach(t => {
        const status = t.status === "passed" ? "✔️ PASS" : "❌ FAIL";
        console.log(`  ${status}  ${t.fullName}`);
        if (t.failureMessages.length > 0) {
          console.log("    └── Error:");
          t.failureMessages.forEach(m => {
            console.log("       " + m.replace(/\n/g, "\n       "));
          });
        }
      });
    });
    console.log("\n==============================================\n");
  }
}

module.exports = CleanReporter;
