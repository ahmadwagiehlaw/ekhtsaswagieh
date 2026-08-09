const fs = require('fs');
const code = fs.readFileSync('src/pages/CaseDetails.jsx', 'utf8');
const start = code.indexOf("{activeTab === 'sessions' && (");
// The end is the matching closing brace. Since we know where it is approximately:
const nextTab = code.indexOf("{/* Tab Content: Documents */}", start);
const endSnippet = '  )}';
const end = code.lastIndexOf(')}', nextTab) + 2;

fs.writeFileSync('sessions_block.txt', code.substring(start, end));
console.log("Done");
