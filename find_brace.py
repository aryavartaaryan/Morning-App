with open('app/wallpaper.tsx', 'r') as f:
    lines = f.readlines()

count = 0
for i, line in enumerate(lines, 1):
    for char in line:
        if char == '{': count += 1
        elif char == '}': count -= 1
    if 'export default function WallpaperSettings()' in line:
        print(f"Func start at {i}, count {count}")
    if 'const styles = StyleSheet.create({' in line:
        print(f"Styles start at {i}, count {count}")
    if i == len(lines):
        print(f"End count: {count}")
