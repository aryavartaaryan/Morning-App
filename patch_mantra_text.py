import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    old_text = '    transliteration: "Om sarve bhavantu sukhinah\\nsarve santu niramayah",'
    new_text = '    transliteration: "Om sarve bhavantu sukhinah\\nsarve santu niramayah\\nsarve bhadrani pashyantu\\nma kashchid duhkha bhagbhavet",'

    content = content.replace(old_text, new_text)

    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched mantra text successfully.")

if __name__ == "__main__":
    main()
