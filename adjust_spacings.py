import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Adjust Dock paddingBottom
    dock_target = "paddingBottom: 24, paddingTop: 6"
    dock_replacement = "paddingBottom: 32, paddingTop: 6"
    
    if dock_target in content:
        content = content.replace(dock_target, dock_replacement)
        print("Updated Dock paddingBottom to 32.")
    else:
        print("Could not find dock target.")

    # 2. Adjust Weather Button marginTop
    weather_target = "{/* 4. Weather Button (Fixed below Bio-State) */}\n              <View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 8, alignItems: 'center' }}>"
    weather_replacement = "{/* 4. Weather Button (Fixed below Bio-State) */}\n              <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 16, marginBottom: 8, alignItems: 'center' }}>"
    
    if weather_target in content:
        content = content.replace(weather_target, weather_replacement)
        print("Added marginTop to Weather Button.")
    else:
        print("Could not find weather button target.")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
