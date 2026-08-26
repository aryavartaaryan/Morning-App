import os

file_path = "app/(tabs)/sleep.tsx"

with open(file_path, "r") as f:
    content = f.read()

target = """      {isSearching && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, backgroundColor: '#03030D' }}>
          <FlatList"""

replacement = """      {isSearching && (
        <Animated.View style={{ position: 'absolute', top: insets.top + 62, left: 0, right: 0, bottom: 0, zIndex: 9, backgroundColor: 'rgba(3,3,13,0.95)' }}>
          <FlatList"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Target not found.")

