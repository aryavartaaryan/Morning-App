import os
import glob

files = glob.glob('app/(tabs)/*.tsx') + ['app/wallpaper.tsx']

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Replace navigate('/(tabs)/index') with navigate('/(tabs)')
        new_content = content.replace("router.navigate('/(tabs)/index')", "router.navigate('/(tabs)')")
        
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Patched {filepath}")

