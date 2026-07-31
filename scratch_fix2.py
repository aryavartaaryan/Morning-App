import sys

with open('app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

start_str = "// ── Hero Geometric Animation (from Sound Reel) ──\nfunction sacredDots("
end_str = "\nfunction HeroRingDisplay("

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + "// ── Hero Geometric Animation (Imported) ──" + content[end_idx:]
    with open('app/(tabs)/index.tsx', 'w') as f:
        f.write(new_content)
    print("Success")
else:
    print(f"Failed to find indices: {start_idx}, {end_idx}")
