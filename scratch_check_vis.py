import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

start_marker = "{/* ── INNOVATIVE IMMERSIVE AUDIO VISUALIZATION ── */}"
end_marker = "{/* Loading Spinner */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(content[start_idx:end_idx])

