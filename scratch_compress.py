import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. ScrollView gap compression
    target_scroll_gap = "gap: 12" # main container gap
    # Need to be specific about which gap
    target_gap_block = "<View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 12 }}>"
    rep_gap_block = "<View style={{ width: '100%', paddingHorizontal: 24, alignItems: 'center', gap: 8 }}>"
    if target_gap_block in content:
        content = content.replace(target_gap_block, rep_gap_block)
        print("Replaced main gap")

    # 2. Biorhythm Card padding
    # Currently paddingVertical: 24.
    target_bio_pad = "paddingVertical: 24,"
    rep_bio_pad = "paddingVertical: 18,"
    if target_bio_pad in content:
        content = content.replace(target_bio_pad, rep_bio_pad, 1)
        print("Replaced bio pad")

    # 3. Active Bio-State Panel padding
    target_state_pad = """                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 12,
                      paddingHorizontal: 20,"""
    rep_state_pad = """                      borderRadius: 24,
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.2)',
                      paddingVertical: 10,
                      paddingHorizontal: 20,"""
    if target_state_pad in content:
        content = content.replace(target_state_pad, rep_state_pad)
        print("Replaced state pad")
        
    # 4. Dock paddingBottom (Circadian grid pushed up)
    # The user says "slighlt pushed the circadian grid liitle up jist lisght up" -> meaning they want the elements ABOVE the dock to be higher up. We do this by reducing gaps, which we just did.
    # The user also wants to "pull teh wather buuton liitle up".
    # Reducing gaps above the weather button will naturally pull it up!
    # Let's also check intention card padding.
    target_intention = """                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    overflow: 'hidden',"""
    rep_intention = """                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    overflow: 'hidden',"""
    if target_intention in content:
        content = content.replace(target_intention, rep_intention)
        print("Replaced intention pad")
        
    # 5. Moon phase header vertical padding
    target_moon_header = """                paddingHorizontal: 22, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.2)'"""
    rep_moon_header = """                paddingHorizontal: 22, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.2)'"""
    if target_moon_header in content:
        content = content.replace(target_moon_header, rep_moon_header)
        print("Replaced moon header pad")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
