const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', 'utf8');

// 1. Fix SVG Mask
code = code.replace(
  /<Svg width=\{SCAN_W\} height=\{SCAN_H\} viewBox="0 0 220 205">[\s\S]*?<\/Svg>/m,
  `<Svg width={SCAN_W} height={SCAN_H} viewBox="0 0 220 205">
              <Defs>
                <Mask id="hole">
                  <Rect x="-10" y="-10" width="250" height="250" fill="white" />
                  <Path d={HEART} fill="black" />
                </Mask>
              </Defs>
              <Rect x="-10" y="-10" width="250" height="250" fill="black" mask="url(#hole)" />
              <AnimatedPath d={HEART} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
            </Svg>`
);

// 2. Fix Lock-in Animation
code = code.replace(
  /if \(p === 'warming_up' \|\| p === 'measuring'\) \{/,
  `if (p === 'warming_up' || p === 'measuring') {
      if (phaseRef.current !== 'warming_up' && phaseRef.current !== 'measuring') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.sequence([
          Animated.timing(beatAnim, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 1.0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true })
        ]).start();
      }`
);

// 3. Fix Results categorization
code = code.replace(
  /let color = '#10b981';[\s\S]*?setResult\(\{ hrv: 42, score: data\.stressScore[\s\S]*?\}\);/m,
  `let color = '#10b981';
    let label = 'Low Stress';
    let emoji = '😌';
    let subtitle = 'Your nervous system is balanced and relaxed.';
    
    if (data.stressScore > 500) {
      color = '#ef4444'; label = 'High Stress'; emoji = '⚡';
      subtitle = 'Elevated sympathetic activity detected.';
    } else if (data.stressScore > 150) {
      color = '#f59e0b'; label = 'Moderate Stress'; emoji = '🤔';
      subtitle = 'You are experiencing moderate strain.';
    }
    
    setResult({ ...data, color, label, emoji, subtitle, advice: ['Take a deep breath', 'Listen to a calming sound'] });`
);

// 4. Update the Results UI to show RMSSD and SDNN
code = code.replace(
  /<View style=\{S\.resRow\}>\s*<Text style=\{S\.resKey\}>HRV \(RMSSD\)<\/Text>\s*<Text style=\{S\.resVal\}>\{result\.hrv\} ms<\/Text>\s*<\/View>/m,
  `<View style={S.resRow}>
              <Text style={S.resKey}>HRV (RMSSD){'\\n'}<Text style={{fontSize: 12, color: '#666'}}>Short-term rhythm variation</Text></Text>
              <Text style={S.resVal}>{result.rmssd} ms</Text>
            </View>
            <View style={S.resRow}>
              <Text style={S.resKey}>SDNN{'\\n'}<Text style={{fontSize: 12, color: '#666'}}>Overall variability</Text></Text>
              <Text style={S.resVal}>{result.sdnn} ms</Text>
            </View>`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', code);
