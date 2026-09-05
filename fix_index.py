import re

with open('app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# We need to remove the massive duplication.
# The duplication starts after `DailyIntentionCard` or similar. Let's find where "2. Zen Monolith Active Bio-State Panel" is defined twice.
# We will just split by "export default withScreenBoundary"
parts = content.split('export default withScreenBoundary(DailyTab, \'Home\');')

# It's probably in parts[0] which is huge.
if len(parts) > 2:
    print("Found multiple export default lines. Truncating file.")
    # The file has multiple exports, meaning the script inserted a huge chunk.
    # Keep the first part, then append the export line.
    with open('app/(tabs)/index.tsx', 'w') as f:
        f.write(parts[0] + 'export default withScreenBoundary(DailyTab, \'Home\');\n')
else:
    print("File doesn't have multiple exports. Manual cleanup needed.")

