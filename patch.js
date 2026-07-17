const fs = require('fs');
const file = 'app/(auth)/onboarding.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add SVG import
if (!content.includes('react-native-svg')) {
  content = content.replace(
    /import \{ LinearGradient \} from 'expo-linear-gradient';/,
    "import { LinearGradient } from 'expo-linear-gradient';\nimport Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Glow, DropShadow } from 'react-native-svg';"
  );
}

// Replace the top bar with a premium ring
const newHeader = `
          {/* ── PREMIUM ELEGANT PROGRESS RING HEADER ── */}
          {(phase === 'steps' || phase === 'quiz') && (
            <View style={styles.premiumRingHeader}>
              <View style={styles.premiumRingContainer}>
                {/* SVG Progress Ring */}
                <Svg width="56" height="56" viewBox="0 0 56 56">
                  <Defs>
                    <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#E5C07B" />
                      <Stop offset="50%" stopColor="#D4A840" />
                      <Stop offset="100%" stopColor="#F5C842" />
                    </SvgGradient>
                    <SvgGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
                      <Stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
                    </SvgGradient>
                  </Defs>
                  {/* Background Track Circle */}
                  <Circle
                    cx="28" cy="28" r="24"
                    stroke="url(#bgGrad)" strokeWidth="3" fill="none"
                  />
                  {/* Animated Foreground Circle */}
                  <Circle
                    cx="28" cy="28" r="24"
                    stroke="url(#ringGrad)" strokeWidth="3" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={24 * 2 * Math.PI}
                    strokeDashoffset={24 * 2 * Math.PI * (1 - ((stepIdx + (phase === 'quiz' ? steps.length : 0)) / totalSteps))}
                    transform="rotate(-90 28 28)"
                  />
                </Svg>
                
                {/* Center Counter */}
                <View style={styles.premiumRingCenter}>
                  <Text style={styles.premiumRingCount}>
                    {stepIdx + 1 + (phase === 'quiz' ? steps.length : 0)}
                  </Text>
                  <Text style={styles.premiumRingTotal}>
                    /{totalSteps}
                  </Text>
                </View>
              </View>

              <View style={styles.premiumHeaderTitles}>
                <Text style={styles.premiumPhaseBadgeTxt}>{PHASE_BADGE}</Text>
                <Text style={styles.premiumSubBadgeTxt}>YOUR JOURNEY</Text>
              </View>
            </View>
          )}
`;

content = content.replace(
  /\{\/\* ── PREMIUM STRUCTURAL PROGRESS HEADER ── \*\/\}[\s\S]*?\}\)/,
  newHeader
);

// Update styles
content = content.replace(
  /studioHeader: \{[\s\S]*?\},/,
  \`premiumRingHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, backgroundColor: 'transparent' },
  premiumRingContainer: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  premiumRingCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  premiumRingCount: { color: Colors.gold, fontSize: 16, fontWeight: '600', lineHeight: 18 },
  premiumRingTotal: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: -2 },
  premiumHeaderTitles: { marginLeft: 18, justifyContent: 'center' },
  premiumPhaseBadgeTxt: { color: Colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  premiumSubBadgeTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', letterSpacing: 1 },\`
);
// Remove studio remnants
content = content.replace(/studioHeaderTop: \{[\s\S]*?\},/, '');
content = content.replace(/studioStepCount: \{[\s\S]*?\},/, '');
content = content.replace(/studioProgressTrack: \{[\s\S]*?\},/, '');
content = content.replace(/studioProgressFill: \{[\s\S]*?\},/, '');
content = content.replace(/studioProgressTick: \{[\s\S]*?\},/, '');

fs.writeFileSync(file, content);
console.log('Progress ring patched');
