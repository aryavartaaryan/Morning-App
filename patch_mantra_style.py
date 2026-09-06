import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    old_style = """    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,10,10,0.4)',
    alignItems: 'center', // Center everything
    // Heavy floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 20,"""
    
    new_style = """    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15,15,15,0.55)',
    alignItems: 'center', // Center everything"""

    content = content.replace(old_style, new_style)

    with open(file_path, 'w') as f:
        f.write(content)
        
if __name__ == "__main__":
    main()
