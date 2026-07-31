const fs = require('fs');
const content = fs.readFileSync('lib/bgImages.ts', 'utf8');

const updated = content.replace(/'(https:\/\/images\.pexels\.com\/photos\/[^/]+\/[^/]+?\.(?:jpeg|jpg|png))(?!.*?auto=compress)'/g, "'$1?auto=compress&cs=tinysrgb&w=800&q=90'");

fs.writeFileSync('lib/bgImages.ts', updated);
console.log('Fixed URLs');
