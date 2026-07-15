const fs = require('fs');
const path = require('path');

function walkAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkAndReplace(fullPath);
    } else {
      if (!fullPath.endsWith('.xml') && !fullPath.endsWith('.kt') && !fullPath.endsWith('.java')) {
        continue;
      }
      
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
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
        console.log('Updated Android', fullPath);
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

walkAndReplace(path.join(__dirname, 'android', 'app', 'src'));
console.log('Done Android files.');
