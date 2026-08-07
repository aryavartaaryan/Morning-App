const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/sleep.tsx', 'utf8');

const idx1 = content.indexOf('// ─── Ultra-Fast Animated Close Prompt ─────────────────────────────────────────');
const idx2 = content.indexOf('// ─── Modal implementation ──────────────────────────────────────────────────');
const idx3 = content.indexOf('  const [showClosePrompt, setShowClosePrompt] = useState(false);');

if (idx1 === -1 || idx2 === -1 || idx3 === -1) {
    console.error("Could not find markers", {idx1, idx2, idx3});
    process.exit(1);
}

const extractedPrompts = content.substring(idx1, idx2);
const toDelete = content.substring(idx2, idx3);

console.log("Extracted prompts length:", extractedPrompts.length);
console.log("Deleted text length:", toDelete.length);

content = content.substring(0, idx1) + content.substring(idx3);

const idxInsert = content.indexOf('const SoundReelsModal = memo(function SoundReelsModal({');
content = content.substring(0, idxInsert) + extractedPrompts + '\n' + content.substring(idxInsert);

fs.writeFileSync('app/(tabs)/sleep.tsx', content);
console.log("Done");
