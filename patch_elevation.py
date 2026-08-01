import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We added zIndex: 100 in the last step. Now we add elevation: 100 next to it.
    new_content = content.replace('zIndex: 100', 'zIndex: 100, elevation: 100')
    
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

