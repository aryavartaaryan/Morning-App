import sys
import re

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    dock_pattern = r"\{/\* ── PREMIUM VISIONOS GLASS DOCK ── \*/\}.*?</BlurView>\s*</View>"
    
    # Let's find all matches
    matches = list(re.finditer(dock_pattern, content, flags=re.DOTALL))
    print(f"Found {len(matches)} docks.")
    
    if len(matches) > 1:
        # Keep only the last one (which should be the main DailyTab layout)
        last_match = matches[-1]
        
        # Build the new content by removing all but the last match
        new_content = content[:last_match.start()]
        # Remove all other docks from the first part
        new_content = re.sub(dock_pattern, "", new_content, flags=re.DOTALL)
        
        # Add the last dock back
        dock_str = last_match.group(0)
        
        # Increase paddingBottom in the dock_str to push it up
        dock_str = dock_str.replace("paddingBottom: 12", "paddingBottom: 24")
        
        new_content += dock_str
        new_content += content[last_match.end():]
        
        with open(file_path, 'w') as f:
            f.write(new_content)
        print("Removed rogue docks and updated padding.")
    else:
        print("Expected multiple docks, found", len(matches))

if __name__ == "__main__":
    main()
