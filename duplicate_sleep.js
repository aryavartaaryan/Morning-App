const fs = require('fs');
const path = '/Users/hotelnamastebharatinn/Desktop/Morning-App/lib/sleepSoundsData.ts';
let code = fs.readFileSync(path, 'utf8');

const targets = [
  'id: \'cdn_bhimpalasi\'',
  'id: \'cdn_ultra_raag_bahar_528\'',
  'id: \'cdn_new_12\'',
  'id: \'cdn_new_22\'',
  'id: \'nc_raga_deepam_veena_flute_1\'',
  'id: \'nc_raga_deepam_veena_flute_2\'',
  'id: \'nc_sitar_overthinking_heal\'',
  'id: \'cdn_new_52\'',
  'id: \'cdn_new_34\'',
  'id: \'med_raga_fusions\'',
];

const lines = code.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  newLines.push(line);
  
  if (line.includes('{ id: \'') && targets.some(t => line.includes(t))) {
    let newLine = line.replace(/id:\s*'([^']+)'/, "id: '$1_sleep'");
    newLine = newLine.replace(/cat:\s*'Ragas'|cat:\s*'Meditations'|cat:\s*'Nature'/, "cat: 'Sleep'");
    newLines.push(newLine);
  }
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('Duplication done.');
