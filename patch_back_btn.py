import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content

    # Add zIndex: 100 to backBtn and dismissBtn styles if not present
    # We look for backBtn: { ... } and insert zIndex
    
    def replacer(m):
        full = m.group(0)
        if 'zIndex' in full:
            return full
        # insert before the closing brace
        return full[:-1] + ', zIndex: 100 }'
        
    new_content = re.sub(r'backBtn:\s*\{[^}]+\}', replacer, new_content)
    new_content = re.sub(r'dismissBtn:\s*\{[^}]+\}', replacer, new_content)
    new_content = re.sub(r'skipBtn:\s*\{[^}]+\}', replacer, new_content)

    # For inline styles that have router.back(), like in cosmic-daily.tsx
    # style={{ flexDirection: 'row', ... }}
    def inline_replacer(m):
        full = m.group(0)
        if 'zIndex' in full:
            return full
        return full.replace('}}', ', zIndex: 100 }}')
        
    new_content = re.sub(r'style=\{\{[^}]*\}\}(?=\s*>\s*<Text[^>]*>[\s]*[<‹]?[^\n]*BACK)', inline_replacer, new_content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('app'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
            
for root, _, files in os.walk('components'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

