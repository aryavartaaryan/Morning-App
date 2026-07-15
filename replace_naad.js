const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.git', 'android', 'ios', 'dist', 'assets', '.expo'];

function walkAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        walkAndReplace(fullPath);
      }
    } else {
      if (!fullPath.endsWith('.tsx') && !fullPath.endsWith('.ts') && !fullPath.endsWith('.json') && !fullPath.endsWith('.md')) {
        continue;
      }
      
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      // Do not touch lines with http or https
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('http://') || lines[i].includes('https://')) {
          continue;
        }
        lines[i] = lines[i].replace(/\bNaad\b/g, 'Nada');
        lines[i] = lines[i].replace(/\bNAAD\b/g, 'NADA');
      }
      content = lines.join('\n');
      
      if (content !== originalContent) {
        console.log('Updated', fullPath);
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

walkAndReplace(__dirname);
console.log('Done JS files.');
