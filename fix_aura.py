import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    old_gold = """      <Animated.View style={{
        position: 'absolute',
        top: '15%', left: '10%', right: '10%',
        height: 250,
        borderRadius: 150,
        backgroundColor: '#FCD34D', // Deep glowing Gold
        opacity: opacity1,
        transform: [{ scale: scale1 }],
      }} />"""
      
    new_gold = """      <Animated.View style={{
        position: 'absolute',
        top: '15%', left: '10%', right: '10%',
        height: 250,
        borderRadius: 150,
        backgroundColor: '#FCD34D', // Deep glowing Gold
        opacity: opacity1,
        transform: [{ scale: scale1 }],
        // @ts-ignore
        filter: [{ blur: 60 }]
      }} />"""
      
    old_orange = """      <Animated.View style={{
        position: 'absolute',
        top: '45%', left: '5%', right: '5%',
        height: 250,
        borderRadius: 150,
        backgroundColor: '#EA580C', // Deep Orange
        opacity: opacity2,
        transform: [{ scale: scale2 }],
      }} />"""
      
    new_orange = """      <Animated.View style={{
        position: 'absolute',
        top: '45%', left: '5%', right: '5%',
        height: 250,
        borderRadius: 150,
        backgroundColor: '#EA580C', // Deep Orange
        opacity: opacity2,
        transform: [{ scale: scale2 }],
        // @ts-ignore
        filter: [{ blur: 60 }]
      }} />"""

    content = content.replace(old_gold, new_gold)
    content = content.replace(old_orange, new_orange)

    with open(file_path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
