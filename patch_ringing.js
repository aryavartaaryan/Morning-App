const fs = require('fs');

const files = [
  'app/wake-alarm-ringing.tsx',
  'app/sleep-ringing.tsx',
  'app/soundbath-ringing.tsx',
  'app/habit-alarm-ringing.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // 1. Add rotVal
  if (!content.includes('const rotVal')) {
    content = content.replace(
      /const btnScale\s*=\s*useSharedValue\(1\);/g,
      `const btnScale     = useSharedValue(1);\n  const rotVal       = useSharedValue(0);`
    );
  }

  // 2. Add rotStyle
  if (!content.includes('const rotStyle')) {
    content = content.replace(
      /const btnStyle\s*=\s*useAnimatedStyle\(\(\) => \(\{ transform: \[\{ scale: btnScale\.value \}\] \}\)\);/g,
      `const btnStyle   = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));\n  const rotStyle   = useAnimatedStyle(() => ({ transform: [{ rotate: \`\${rotVal.value}deg\` }] }));\n  const rotRevStyle = useAnimatedStyle(() => ({ transform: [{ rotate: \`-\${rotVal.value}deg\` }] }));`
    );
  }

  // 3. Add rotVal animation to useEffect
  if (!content.includes('rotVal.value = withRepeat')) {
    content = content.replace(
      /btnScale\.value = withRepeat\([\s\S]*?\);/g,
      match => `${match}\n    rotVal.value = withRepeat(withTiming(360, { duration: 25000, easing: Easing.linear }), -1, false);`
    );
    // Also cancelAnimation
    content = content.replace(
      /cancelAnimation\(btnScale\);/g,
      `cancelAnimation(btnScale);\n      cancelAnimation(rotVal);`
    );
  }

  // 4. Replace orbWrap
  const newOrb = `
      {/* ── CENTER: PREMIUM PULSING ORB ── */}
      <View style={S.orbWrap} pointerEvents="none">
        {/* Outer ambient glow */}
        <Animated.View style={[S.outerRing, outerStyle, { backgroundColor: accent + '15', borderWidth: 0, shadowColor: accent, shadowOpacity: 0.6, shadowRadius: 50 }]} />
        
        {/* Slow rotating dashed ring */}
        <Animated.View style={[S.midRing, rotStyle, { borderColor: accent + '60', borderStyle: 'dashed', borderWidth: 1.5, opacity: 0.8 }]} />
        
        {/* Reverse rotating outer thin ring */}
        <Animated.View style={[rotRevStyle, { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderColor: accent + '30', borderWidth: 1 }]} />
        
        {/* Sparkle nodes on reverse ring */}
        <Animated.View style={[rotRevStyle, { position: 'absolute', width: 260, height: 260, borderRadius: 130 }]}>
            <View style={{ position: 'absolute', top: -3, left: 127, width: 6, height: 6, borderRadius: 3, backgroundColor: accent, shadowColor: accent, shadowOpacity: 1, shadowRadius: 10 }} />
            <View style={{ position: 'absolute', bottom: -3, left: 127, width: 6, height: 6, borderRadius: 3, backgroundColor: accent, shadowColor: accent, shadowOpacity: 1, shadowRadius: 10 }} />
        </Animated.View>

        {/* Inner solid core with intense drop shadow */}
        <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: accent + '25', borderColor: accent + '80', shadowColor: accent, shadowOpacity: 1, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }]}>
          <Text style={S.orbIcon}>{wakeSound.icon}</Text>
        </Animated.View>
      </View>
`;
  
  // Need to handle different icon variables.
  // wake-alarm: wakeSound.icon
  // sleep-ringing: sleepSound.icon
  // soundbath-ringing: bathSound.icon
  // habit-alarm: habitEmoji
  
  let iconVar = 'wakeSound.icon';
  if (file.includes('sleep')) iconVar = 'sleepSound.icon';
  if (file.includes('soundbath')) iconVar = 'bathSound.icon';
  if (file.includes('habit')) iconVar = 'habitEmoji';

  const customizedOrb = newOrb.replace('wakeSound.icon', iconVar);

  content = content.replace(
    /\{\/\* ── CENTER: pulsing orb ── \*\/\}[\s\S]*?\<\/View\>/,
    customizedOrb
  );

  fs.writeFileSync(file, content);
  console.log(`Patched ${file}`);
}
