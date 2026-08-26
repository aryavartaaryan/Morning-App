import os

file_path = "app/(tabs)/sleep.tsx"

with open(file_path, "r") as f:
    content = f.read()

target = """          <BlurView intensity={40} tint="dark" style={{ 
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 12, paddingVertical: 6,
            backgroundColor: isExpanded ? 'rgba(167, 139, 250, 0.05)' : 'rgba(167, 139, 250, 0.12)', 
            borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(167, 139, 250, 0.3)',
          }}>
            <Ionicons name="time-outline" size={12} color="#d8b4fe" />
            <Text style={{ fontSize: 10, color: '#f3e8ff', fontFamily: 'Nunito_700Bold', letterSpacing: 1, textTransform: 'uppercase' }}>
              Recently Played
            </Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color="rgba(255,255,255,0.5)" />
          </BlurView>"""

replacement = """          <BlurView intensity={50} tint="dark" style={{ 
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 16, paddingVertical: 8,
            backgroundColor: isExpanded ? 'rgba(167, 139, 250, 0.08)' : 'rgba(167, 139, 250, 0.15)', 
            borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.3)',
            borderRadius: 20
          }}>
            <Ionicons name="time-outline" size={14} color="#d8b4fe" />
            <Text style={{ fontSize: 11, color: '#f3e8ff', fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Recently Played
            </Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="rgba(255,255,255,0.7)" />
          </BlurView>"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Target not found.")
