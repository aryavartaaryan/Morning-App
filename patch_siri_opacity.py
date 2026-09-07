import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Decrease opacity of the cloud blooming
    old_opacity = "const cloudOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.65] });"
    new_opacity = "const cloudOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.35] });"
    content = content.replace(old_opacity, new_opacity)

    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched Siri Aura opacity successfully.")

if __name__ == "__main__":
    main()
