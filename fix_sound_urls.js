const fs = require('fs');
const content = fs.readFileSync('lib/sleepSoundsData.ts', 'utf8');

const updated = content.replace(/'(https:\/\/images\.pexels\.com\/photos\/[^/]+\/[^/]+?\.(?:jpeg|jpg|png))(?!.*?auto=compress)'/g, "'$1?auto=compress&cs=tinysrgb&w=600'");

if (content !== updated) {
  fs.writeFileSync('lib/sleepSoundsData.ts', updated);
  console.log('Fixed URLs in sleepSoundsData.ts');
} else {
  console.log('No URLs to fix in sleepSoundsData.ts');
}
