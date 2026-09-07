import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    old_block = """            {/* ── Mantra Transliteration ── */}
            <Text style={{ 
                fontFamily: 'serif', fontStyle: 'italic', fontSize: 18, color: '#FFF', 
                textAlign: 'center', lineHeight: 24, marginBottom: 10 
            }}>
                Om sarve bhavantu sukhinah{"\\n"}sarve santu niramayah
            </Text>

            {/* ── English Meaning ── */}
            <Text style={{ 
                fontFamily: 'sans-serif', fontStyle: 'italic', fontSize: 12, color: 'rgba(255,255,255,0.6)', 
                textAlign: 'center', lineHeight: 16, marginBottom: 16, paddingHorizontal: 16 
            }}>
                "May all be happy, may all be free from illness. May no one suffer."
            </Text>"""
            
    new_block = """            {/* ── Mantra Transliteration ── */}
            <Text style={{ 
                fontFamily: 'serif', fontStyle: 'italic', fontSize: 16, color: '#FFF', 
                textAlign: 'center', lineHeight: 22, marginBottom: 8 
            }}>
                {mantra.transliteration}
            </Text>

            {/* ── English Meaning ── */}
            <Text style={{ 
                fontFamily: 'sans-serif', fontStyle: 'italic', fontSize: 11, color: 'rgba(255,255,255,0.6)', 
                textAlign: 'center', lineHeight: 16, marginBottom: 14, paddingHorizontal: 16 
            }}>
                "{mantra.meaning}"
            </Text>"""

    if old_block in content:
        content = content.replace(old_block, new_block)
        with open(file_path, 'w') as f:
            f.write(content)
        print("Mantra updated dynamically successfully.")
    else:
        print("Failed to find old block.")

if __name__ == "__main__":
    main()
