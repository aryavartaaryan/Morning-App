const fs = require('fs');
const content = fs.readFileSync('app/(tabs)/sleep.tsx', 'utf8');
const match = content.match(/export const SONIC_COLLECTIONS: SonicCollection\[\] = \[([\s\S]*?)\];/);
if (match) {
  let innerStr = match[1];
  // naive check via regex just extract arrays
  const regex = /soundIds:\s*\[(.*?)\]/g;
  let matches = [...innerStr.matchAll(regex)];
  matches.forEach(m => {
    let ids = m[1].replace(/'/g, '').split(',').map(s => s.trim()).filter(s => s);
    let duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
    if (duplicates.length) {
      console.log('Duplicates found:', duplicates);
    }
  });
  console.log('Finished checking');
}
