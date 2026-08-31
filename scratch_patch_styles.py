import sys

def main():
    file_path = 'components/MetabolicStoryModal.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # heroHeadline
    content = content.replace("fontSize: 32,", "fontSize: 28,")
    content = content.replace("lineHeight: 40,", "lineHeight: 36,")
    
    # windowTimeText
    content = content.replace("fontSize: 26,", "fontSize: 22,")
    
    # heroTagline
    content = content.replace("fontSize: 14,", "fontSize: 13,")
    
    # cardTitle
    content = content.replace("fontSize: 16,", "fontSize: 15,")
    
    # bodyParagraph
    target_bp = """  bodyParagraph: {
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: '400',
  },"""
    rep_bp = """  bodyParagraph: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '400',
  },"""
    content = content.replace(target_bp, rep_bp)
    
    # Also for `timeWindowCard`, `card` padding
    content = content.replace("padding: 20,", "padding: 24,")
    
    # Add a bit of negative space to scrollContent
    content = content.replace("paddingTop: 20,", "paddingTop: 24, paddingBottom: 24,")

    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Modal styles successfully!")

if __name__ == '__main__':
    main()
