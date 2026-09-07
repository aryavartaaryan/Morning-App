import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Reduce ScrollView paddingTop
    # <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
    content = content.replace("paddingTop: 16, paddingBottom: 20", "paddingTop: 4, paddingBottom: 10")

    # 2. Reduce Mantra wrapper margins and paddings
    # <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 12 }}>
    content = content.replace("<View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 12 }}>", "<View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 8 }}>")
    
    # 3. Reduce Bio-State wrapper margins and paddings
    # <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 16 }}>
    content = content.replace("<View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 16 }}>", "<View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 12 }}>")

    # 4. Reduce Weather wrapper margins
    # <View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 8, alignItems: 'center' }}>
    content = content.replace("<View style={{ width: '100%', paddingHorizontal: 24, marginBottom: 8, alignItems: 'center' }}>", "<View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 8, alignItems: 'center' }}>")

    # 5. Reduce Dock wrapper paddings
    # <View style={{ width: '100%', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12, backgroundColor: 'transparent' }}>
    content = content.replace("<View style={{ width: '100%', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12, backgroundColor: 'transparent' }}>", "<View style={{ width: '100%', paddingHorizontal: 20, paddingBottom: 8, paddingTop: 6, backgroundColor: 'transparent' }}>")
    
    # Also reduce Dock button padding
    # paddingVertical: 12
    content = content.replace("paddingVertical: 12, borderRightWidth", "paddingVertical: 10, borderRightWidth")
    content = content.replace("paddingVertical: 12 }}", "paddingVertical: 10 }}")

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Compressed index.tsx successfully.")

    # Now compress DailyIntentionCard.tsx
    file_path_2 = 'components/DailyIntentionCard.tsx'
    with open(file_path_2, 'r') as f2:
        content2 = f2.read()

    # paddingVertical: 18, paddingHorizontal: 16 -> 14, 14
    content2 = content2.replace("paddingVertical: 18,\n    paddingHorizontal: 16,", "paddingVertical: 14,\n    paddingHorizontal: 16,")
    # marginBottom: 10 -> 8
    content2 = content2.replace("marginBottom: 10 }]", "marginBottom: 8 }]")
    content2 = content2.replace("lineHeight: 22, marginBottom: 8", "lineHeight: 20, marginBottom: 6")
    content2 = content2.replace("lineHeight: 16, marginBottom: 14, paddingHorizontal: 16", "lineHeight: 14, marginBottom: 10, paddingHorizontal: 10")
    
    with open(file_path_2, 'w') as f2:
        f2.write(content2)
        
    print("Compressed DailyIntentionCard.tsx successfully.")

if __name__ == "__main__":
    main()
