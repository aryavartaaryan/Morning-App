const fs = require('fs');
const file = 'app/(tabs)/sleep.tsx';
let code = fs.readFileSync(file, 'utf8');

// We need to inject spiritual_journey into divine_bhajans
code = code.replace(
  /'cdn_ultra_shiva_stotras', 'med_shiva_stotras'\] \}/,
  "'cdn_ultra_shiva_stotras', 'med_shiva_stotras', 'spiritual_journey'] }"
);

// We need to inject naad_bhajan_flute_tabla into bansuri_flutes
code = code.replace(
  /'naad_himalayan_village_flute_sleep'\] \}/,
  "'naad_himalayan_village_flute_sleep', 'naad_bhajan_flute_tabla'] }"
);

// We need to inject the rest into sitar_tanpura
code = code.replace(
  /'om_shanti'\] \}/,
  "'om_shanti', 'sargija_eastern', 'naad_traditional_koto', 'naad_indian_fusion', 'world_ambient', 'tagore_festival', 'heaven_tune'] }"
);

// Now remove the world_strings object completely
code = code.replace(
  /\s*\{ id: 'world_strings'[\s\S]*?\},/,
  ""
);

fs.writeFileSync(file, code);
console.log("Patched collections successfully.");
