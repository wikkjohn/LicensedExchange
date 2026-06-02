// Runs every end-to-end test in this folder and prints a summary.
// Used by `npm test`. Exits non-zero if any suite fails.
const { execFileSync } = require('child_process');
const path = require('path');

const suites = [
  'e2e_full.js',          // full user journey: signup → login → post → message → save → logout
  'test_pagination.js',   // listings load 24 at a time + "Load more"
  'test_server_search.js' // search + category filter run in the database query
];

let failed = 0;
for (const suite of suites) {
  console.log(`\n──────────── ${suite} ────────────`);
  try {
    execFileSync('node', [path.join(__dirname, suite)], { stdio: 'inherit' });
  } catch (e) {
    failed++;
  }
}

console.log('\n════════════════════════════════');
if (failed === 0) {
  console.log(`✅ All ${suites.length} test suites passed.`);
  process.exit(0);
} else {
  console.log(`❌ ${failed} of ${suites.length} test suites failed.`);
  process.exit(1);
}
