import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# Let's extract the Bottom text & scrubber cluster to see the exact code.
start_marker = "{/* ── BOTTOM TEXT & SCRUBBER CLUSTER ── */}"
end_marker = "{/* ── SAFE AREA SPACER FOR ANDROID ── */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(content[start_idx:start_idx+2000])

