import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The outer container of the Bio-State card was previously <View style={{
    # We want to change it to <BlurView intensity={45} tint="dark" style={{
    
    # We find the exact View that wraps the bio-state card.
    # It looks like this after my last patch:
    # <View style={{
    #                    width: '100%',
    #                    borderRadius: 24,
    #                    borderWidth: 0,
    #                    borderColor: 'rgba(255,255,255,0.1)',
    #                    paddingVertical: 20,
    #                    paddingHorizontal: 20,
    #                    overflow: 'hidden',
    #                    backgroundColor: 'rgba(25, 25, 25, 0.85)',
    #                  }}>
    
    old_wrap = """<View style={{
                        width: '100%',
                        borderRadius: 24,
                        borderWidth: 0,
                        borderColor: 'rgba(255,255,255,0.1)',
                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(25, 25, 25, 0.85)',
                      }}>"""
                      
    new_wrap = """<BlurView intensity={40} tint="dark" style={{
                        width: '100%',
                        borderRadius: 24,
                        borderWidth: 0.5,
                        borderColor: 'rgba(255,255,255,0.15)',
                        paddingVertical: 20,
                        paddingHorizontal: 20,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(10, 10, 10, 0.35)',
                      }}>"""
                      
    if old_wrap in content:
        content = content.replace(old_wrap, new_wrap)
        # also replace the matching closing </View> with </BlurView>
        # The closing tag is exactly before `{/* 4. Weather Button (Fixed below Bio-State) */}`
        # Let's just do a manual replace using indexing.
        
        closing_search = "                      </View>\n                    </TouchableOpacity>\n                 )}</View>\n\n              {/* 4. Weather Button"
        if closing_search in content:
            new_closing = "                      </BlurView>\n                    </TouchableOpacity>\n                 )}</View>\n\n              {/* 4. Weather Button"
            content = content.replace(closing_search, new_closing)
        else:
            # Try a less strict search
            idx1 = content.find("Tap to view metabolic state")
            if idx1 != -1:
                idx2 = content.find("</View>", idx1)
                if idx2 != -1:
                    content = content[:idx2] + "</BlurView>" + content[idx2+7:]
        
        with open(file_path, 'w') as f:
            f.write(content)
        print("Patched Bio-State glass successfully.")
    else:
        print("Could not find the old Bio-State View wrapper.")

if __name__ == "__main__":
    main()
