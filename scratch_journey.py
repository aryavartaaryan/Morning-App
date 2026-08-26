import os

file_path = "app/(tabs)/sleep.tsx"

with open(file_path, "r") as f:
    content = f.read()

target = """      {/* Section Label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 24 }}>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'Nunito_700Bold', letterSpacing: 3, textTransform: 'uppercase' }}>
          Choose Your Journey
        </Text>
        <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' }} />
      </View>"""

replacement = """      {/* Section Label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginBottom: 28 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito_800ExtraBold', letterSpacing: 2.5, textTransform: 'uppercase' }}>
          Choose Your Journey
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
      </View>"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Target not found.")
