import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    
    # We want to find cases of <TouchableOpacity ... onPress={...router.back()...}
    # We can match `<TouchableOpacity` up to `router.back()` and the closing `}` of the onPress
    # But an easier way is to just do a regex replace on the onPress attribute if it contains router.back()
    # Let's match `<TouchableOpacity` followed by anything (non-greedy) up to `onPress={...router.back()...}`
    
    def replacer(m):
        full = m.group(0)
        if 'hitSlop' in full:
            return full
        # Insert hitSlop right after TouchableOpacity
        return full.replace('<TouchableOpacity', '<TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}')

    # This regex looks for <TouchableOpacity followed by any characters until router.back()
    # We use re.DOTALL to allow . to match newlines
    new_content = re.sub(r'<TouchableOpacity(?:(?!<TouchableOpacity).)*?router\.back\(\).*?>', replacer, content, flags=re.DOTALL)
    
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
