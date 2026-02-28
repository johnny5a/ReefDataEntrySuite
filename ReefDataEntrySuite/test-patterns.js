// Test if URL patterns in manifest will match
// Run this: node test-patterns.js

function testPattern(pattern, url) {
  // Convert Chrome extension pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(url);
}

const patterns = [
  "https://data.reef.org/dataentry/*unlisted*",
  "https://data.reef.org/dataentry/*addfish*"
];

const testUrls = [
  "https://data.reef.org/dataentry/unlisted",
  "https://data.reef.org/dataentry/survey/unlisted",
  "https://data.reef.org/dataentry/unlisted/search",
  "https://data.reef.org/dataentry/addfish",
  "https://data.reef.org/dataentry/survey/addfish",
  "https://www.reef.org/dataentry/unlisted",  // Wrong domain
  "https://data.reef.org/dataentry/",          // No unlisted
  "https://data.reef.org/dataentry/survey"     // No unlisted
];

console.log("Testing URL patterns from manifest.json:\n");

testUrls.forEach(url => {
  const matches = patterns.some(pattern => testPattern(pattern, url));
  console.log(`${matches ? '✅' : '❌'} ${url}`);
});

console.log("\n\nIf your URL shows ❌, content-unlisted.js won't load.");
console.log("The URL must contain 'unlisted' or 'addfish' AND be on data.reef.org");
