import re

with open('/tmp/old_sleep.tsx', 'r') as f:
    text = f.read()

# Extract objects
def extract_obj(id_name):
    m = re.search(r'(\{ id: \'' + id_name + r'\'.*?\}\s*\,?\n?)', text)
    if m:
        return m.group(1).strip().rstrip(',')
    return ''

nada_ultra = extract_obj('nada_ultra')
vedic_mantras = extract_obj('vedic_mantras')
divine_bhajans = extract_obj('divine_bhajans')

sitar_tanpura = extract_obj('sitar_tanpura')
bansuri_flutes = extract_obj('bansuri_flutes')
world_strings = extract_obj('world_strings')
healing_frequencies = extract_obj('healing_frequencies')
sleep_sanctuary = extract_obj('sleep_sanctuary')
morning_awakening = extract_obj('morning_awakening')

divine_resonance = extract_obj('divine_resonance')
elemental_immersion = extract_obj('elemental_immersion')
sacred_birds = extract_obj('sacred_birds')

out = "export const SONIC_COLLECTIONS: SonicCollection[] = [\n"
out += f"  {nada_ultra},\n"
out += f"  {vedic_mantras},\n"
out += f"  {divine_bhajans},\n\n"
out += f"  {sitar_tanpura},\n"
out += f"  {bansuri_flutes},\n"
out += f"  {world_strings},\n"
out += f"  {healing_frequencies},\n"
out += f"  {sleep_sanctuary},\n"
out += f"  {morning_awakening},\n\n"
out += f"  {divine_resonance},\n"
out += f"  {elemental_immersion},\n"
out += f"  {sacred_birds}\n"
out += "];\n\n\n"

with open('app/(tabs)/sleep.tsx', 'r') as f:
    current = f.read()

start_idx = current.find('export const SONIC_COLLECTIONS')
end_idx = current.find('// ─── Solar-aware section label map')

new_text = current[:start_idx] + out + current[end_idx:]

with open('app/(tabs)/sleep.tsx', 'w') as f:
    f.write(new_text)

