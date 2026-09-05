import sys

def main():
    file_path = 'components/DailyIntentionCard.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Add AnimatedWord component above DailyIntentionCard
    animated_word_comp = """
const AnimatedWord = ({ word, index, delayOffset }: { word: string, index: number, delayOffset: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      delay: delayOffset + (index * 120),
      useNativeDriver: true,
    }).start();
  }, []);
  
  return (
    <Animated.Text style={[styles.romanText, { 
      opacity: anim, 
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }]
    }]}>
      {word}{' '}
    </Animated.Text>
  );
};

const AnimatedMeaningWord = ({ word, index, delayOffset }: { word: string, index: number, delayOffset: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      delay: delayOffset + (index * 80),
      useNativeDriver: true,
    }).start();
  }, []);
  
  return (
    <Animated.Text style={[styles.englishText, { 
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }]
    }]}>
      {word}{' '}
    </Animated.Text>
  );
};

"""
    if "const AnimatedWord" not in content:
        content = content.replace("export function DailyIntentionCard", animated_word_comp + "export function DailyIntentionCard")

    # 2. Replace static text rendering with mapped AnimatedWords
    old_text = """            {/* ── Mantra Transliteration ── */}
            <Text style={styles.romanText} numberOfLines={2}>
              {mantra.transliteration}
            </Text>

            {/* ── English Meaning ── */}
            <Text style={styles.englishText} numberOfLines={2}>
              "{mantra.english}"
            </Text>"""
            
    new_text = """            {/* ── Mantra Transliteration ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6, paddingHorizontal: 10 }}>
              {mantra.transliteration.replace(/\\n/g, ' ').split(' ').map((word, i) => (
                <AnimatedWord key={i} word={word} index={i} delayOffset={300} />
              ))}
            </View>

            {/* ── English Meaning ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 10 }}>
              <Text style={[styles.englishText, { marginRight: -2 }]}>"</Text>
              {mantra.english.split(' ').map((word, i) => (
                <AnimatedMeaningWord key={i} word={word} index={i} delayOffset={300 + (mantra.transliteration.split(' ').length * 120)} />
              ))}
              <Text style={[styles.englishText, { marginLeft: -4 }]}>"</Text>
            </View>"""
            
    content = content.replace(old_text, new_text)

    # 3. Clean up styles since we applied them to individual words inside a flex row
    # Remove text-align and margins from text styles to prevent weird wrapping issues
    # Just a small patch
    content = content.replace("textAlign: 'center',\n    marginBottom: 6,\n    paddingHorizontal: 10,", "")
    content = content.replace("textAlign: 'center',\n    paddingHorizontal: 10,", "")

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
