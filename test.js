const parser = require('@babel/parser');
const fs = require('fs');

const code = fs.readFileSync('app/(tabs)/sleep.tsx', 'utf-8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("No syntax errors found.");
} catch (e) {
  console.log("Syntax error at line", e.loc.line, "col", e.loc.column);
  console.log(e.message);
}
