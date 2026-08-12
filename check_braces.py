with open('app/wallpaper.tsx', 'r') as f:
    text = f.read()

count = 0
for i, line in enumerate(text.split('\n'), 1):
    for char in line:
        if char == '{': count += 1
        elif char == '}': count -= 1
    if count == 0 and i > 150:
        print(f"Zero at line {i}")
print(f"Final count: {count}")
