import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The issue is the Custom Tab Bar is position: 'absolute' and overlays the screen.
    # We must add paddingBottom to the SafeAreaView so its content doesn't go under the tab bar.
    old_safe_area = "<SafeAreaView style={{ flex: 1 }} edges={['top']}>"
    new_safe_area = "<SafeAreaView style={{ flex: 1, paddingBottom: 80 }} edges={['top']}>"
    
    if old_safe_area in content:
        content = content.replace(old_safe_area, new_safe_area)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Added bottom padding to SafeAreaView successfully.")
    else:
        print("Could not find SafeAreaView.")

if __name__ == "__main__":
    main()
