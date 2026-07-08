const fs = require('fs');
const path = '/Users/hotelnamastebharatinn/Desktop/Morning-App/lib/sleepSoundsData.ts';
let code = fs.readFileSync(path, 'utf8');

const targets = [
  'nada_raga_sparkle',
  'nada_relaxing_flute',
  'nada_himalayan_village_flute',
  'bansuri_melody',
  'nc_sitar_overthinking_heal',
  'nc_raga_deepam_veena_flute_1',
  'nc_raga_deepam_veena_flute_2',
  'nada_zen_bamboo_flow',
  'cdn_bhimpalasi',
  'cdn_ultra_raag_bahar_528',
  'cdn_new_12',
  'cdn_new_22',
  'cdn_new_52',
  'cdn_new_34',
  'med_raga_fusions',
];

const lines = code.split('\n');
const newLines = [];
let inSoundImages = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  newLines.push(line);
  
  if (line.includes('export const SOUND_IMAGES')) {
    inSoundImages = true;
  }
  if (inSoundImages && line.trim() === '};') {
    inSoundImages = false;
  }
  
  if (inSoundImages) {
    for (const target of targets) {
      if (line.includes(target + ':')) {
        const sleepKey = target + '_sleep';
        // check if next line or this block already has it?
        // Actually, safer to just add it immediately after, checking if next line already has it.
        if (i + 1 < lines.length && lines[i+1].includes(sleepKey + ':')) {
          continue; // Already added
        }
        
        let newLine = line.replace(target + ':', sleepKey + ':');
        newLines.push(newLine);
      }
    }
  }
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log('Fix done.');
