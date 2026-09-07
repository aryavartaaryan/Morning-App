import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The current text styling is:
    #             <Text style={{ 
    #                 fontFamily: 'serif', fontStyle: 'italic', fontSize: 20, color: '#FFF', 
    #                 textAlign: 'center', lineHeight: 28, marginBottom: 16 
    #             }}>
    # We want to reduce fontSize from 20 to 18, lineHeight to 26, marginBottom to 12.
    
    old_text = "fontFamily: 'serif', fontStyle: 'italic', fontSize: 20, color: '#FFF',"
    new_text = "fontFamily: 'serif', fontStyle: 'italic', fontSize: 18, color: '#FFF',"
    content = content.replace(old_text, new_text)
    
    old_lh = "textAlign: 'center', lineHeight: 28, marginBottom: 16"
    new_lh = "textAlign: 'center', lineHeight: 24, marginBottom: 10"
    content = content.replace(old_lh, new_lh)

    # For the English meaning:
    #             <Text style={{ 
    #                 fontFamily: 'sans-serif', fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,0.6)', 
    #                 textAlign: 'center', lineHeight: 18, marginBottom: 24, paddingHorizontal: 16 
    #             }}>
    # Reduce marginBottom to 16
    old_eng_lh = "textAlign: 'center', lineHeight: 18, marginBottom: 24, paddingHorizontal: 16"
    new_eng_lh = "textAlign: 'center', lineHeight: 16, marginBottom: 16, paddingHorizontal: 16"
    content = content.replace(old_eng_lh, new_eng_lh)

    # Make the card container padding smaller too
    # paddingVertical: 24, paddingHorizontal: 20 -> paddingVertical: 18, paddingHorizontal: 16
    content = content.replace("paddingVertical: 24,\n    paddingHorizontal: 20,", "paddingVertical: 18,\n    paddingHorizontal: 16,")

    # The top row TODAY'S MANTRA marginBottom from 16 to 10
    content = content.replace("marginBottom: 16 }]", "marginBottom: 10 }]")
    
    # Check if we have that explicit 4-line mantra replacement we did earlier which is now breaking the 2 lines:
    # "Om sarve bhavantu sukhinah\nsarve santu niramayah\nsarve bhadrani pashyantu\nma kashchid duhkha bhagbhavet"
    # Actually, in revert_mantra.py, I hardcoded it back to 2 lines for the UI:
    # Om sarve bhavantu sukhinah{"\\n"}sarve santu niramayah
    # So it should be on 2 lines if fontSize is small enough.
    
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fixed Mantra card compactness.")

if __name__ == "__main__":
    main()
