const fs = require('fs');
const path = '/Users/hotelnamastebharatinn/Desktop/Morning-App/lib/sleepSoundsData.ts';
let code = fs.readFileSync(path, 'utf8');

const newImage = 'https://images.pexels.com/photos/9743110/pexels-photo-9743110.jpeg';

let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // For SOUND_IMAGES map
  if (line.includes('nc_raga_deepam_veena_flute_2:')) {
    line = line.replace(/'https:\/\/images\.pexels\.com[^']*'/, `'${newImage}'`);
    lines[i] = line;
  }
  // For the ALL_SLEEP_SOUNDS array
  if (line.includes('id: \'nc_raga_deepam_veena_flute_2\'') || line.includes('id: \'nc_raga_deepam_veena_flute_2_sleep\'')) {
    line = line.replace(/imageUri:\s*'https:\/\/images\.pexels\.com[^']*'/, `imageUri: '${newImage}'`);
    lines[i] = line;
  }
}

// Add the sleep mapping if it doesn't exist
const newLines = [];
let addedMap = false;
for (let i = 0; i < lines.length; i++) {
  newLines.push(lines[i]);
  if (lines[i].includes('nc_raga_deepam_veena_flute_2:') && !addedMap) {
    newLines.push(`  nc_raga_deepam_veena_flute_2_sleep:  '${newImage}',`);
    addedMap = true;
  }
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('Update done.');
