import re
text = '<TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>'
def repl(m):
    return "MATCH: " + m.group(0)
print(re.sub(r'<TouchableOpacity[^>]*>', repl, text))
