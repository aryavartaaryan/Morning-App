import os
import glob

# Find all tsx files in app/(tabs) and app/wallpaper.tsx
files = glob.glob('app/(tabs)/*.tsx') + ['app/wallpaper.tsx']

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Replace navigate('/') with navigate('/(tabs)/index')
        new_content = content.replace("router.navigate('/')", "router.navigate('/(tabs)/index')")
        
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Patched {filepath}")

