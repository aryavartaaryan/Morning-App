import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The outer container is currently:
    # <View style={[styles.cardInner, { backgroundColor: 'rgba(25, 25, 25, 0.85)', borderWidth: 0 }]}>
    old_wrap = "<View style={[styles.cardInner, { backgroundColor: 'rgba(25, 25, 25, 0.85)', borderWidth: 0 }]}>"
    new_wrap = "<BlurView intensity={40} tint=\"dark\" style={[styles.cardInner, { backgroundColor: 'rgba(10, 10, 10, 0.35)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' }]}>"
    
    if old_wrap in content:
        content = content.replace(old_wrap, new_wrap)
        
        # Replace the closing </View> with </BlurView>
        # It is right after the affordance row
        old_close = "            </View>\n          </View>"
        new_close = "            </View>\n          </BlurView>"
        content = content.replace(old_close, new_close)

        with open(file_path, 'w') as f:
            f.write(content)
        print("Patched Mantra glass successfully.")
    else:
        print("Could not find the old Mantra View wrapper.")

if __name__ == "__main__":
    main()
