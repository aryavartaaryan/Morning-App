import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # We need to add drop shadows to `cardInner`
    old_style = """  cardInner: {
    width: '100%',
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center', // Center everything
  },"""
  
    new_style = """  cardInner: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,10,10,0.4)',
    alignItems: 'center', // Center everything
    // Heavy floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 20,
  },"""
  
    if old_style in content:
        content = content.replace(old_style, new_style)
    else:
        # Try a more flexible replacement
        import re
        content = re.sub(
            r"cardInner: \{[^\}]*backgroundColor: 'rgba\(0,0,0,0\.28\)',[^\}]*\},",
            new_style,
            content,
            flags=re.MULTILINE
        )

    # Let's also adjust romanText size to ensure it fits beautifully like the mockup
    content = content.replace("fontSize: 14, // Smaller font to save height", "fontSize: 15, lineHeight: 22,")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
