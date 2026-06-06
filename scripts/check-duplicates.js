#!/usr/bin/env node

/**
 * Standalone script to check for duplicate code
 * Can be run independently of git hooks
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Checking for duplicate code...\n');

const projectRoot = path.resolve(__dirname, '..');

try {
  // Run jscpd with configuration
  execSync(
    'jscpd . --min-lines 5 --min-tokens 50 --config .jscpdrc.json',
    {
      stdio: 'inherit',
      cwd: projectRoot,
      env: { ...process.env, PATH: process.env.PATH },
    }
  );

  console.log('\n✅ No duplicate code found!');
  process.exit(0);
} catch (error) {
  // jscpd exits with code 1 when duplicates are found
  if (error.status === 1) {
    console.error('\n❌ Duplicate code detected!');
    console.error('Please remove duplicate code before committing.\n');
    console.error('Run "npm run check:duplicates:report" for detailed HTML report.');
    process.exit(1);
  } else {
    // Other errors (like jscpd not found)
    console.error('\n❌ Error running duplicate detection:', error.message);
    console.error('Make sure jscpd is installed: npm install');
    process.exit(1);
  }
}

