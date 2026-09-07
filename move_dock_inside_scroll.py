import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The block we need to move the </ScrollView> past
    end_of_dock = """                  </TouchableOpacity>

                </BlurView>
              </View>"""
              
    scroll_close = "        </ScrollView>"
    
    # Let's find the ScrollView close tag
    scroll_idx = content.find(scroll_close)
    if scroll_idx != -1:
        # Delete the </ScrollView> from here
        content = content[:scroll_idx] + content[scroll_idx + len(scroll_close):]
        
        # Now find the end of the dock
        dock_end_idx = content.find(end_of_dock, scroll_idx)
        if dock_end_idx != -1:
            # Insert </ScrollView> after the dock ends
            insert_pos = dock_end_idx + len(end_of_dock)
            content = content[:insert_pos] + "\n\n        </ScrollView>\n" + content[insert_pos:]
            
            with open(file_path, 'w') as f:
                f.write(content)
            print("Moved Dock inside ScrollView successfully.")
        else:
            print("Could not find the end of the dock.")
    else:
        print("Could not find ScrollView close tag.")

if __name__ == "__main__":
    main()
