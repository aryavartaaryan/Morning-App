import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

start_marker = "{/* Floating Mini-Player (Skip / Timer / Skip) - ALWAYS VISIBLE, ULTRA PREMIUM GLASS */}"
end_marker = "{/* ── SAFE AREA SPACER FOR ANDROID ── */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(content[start_idx:end_idx])

