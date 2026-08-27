with open("app/(tabs)/walk.tsx", "r") as f:
    text = f.read()

# Replace the component
start_marker = "const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim }: any) => {"
end_marker = "export default function HarmonyCompassScreen() {"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Failed to find markers")
    exit(1)

# We need to find the exact end of HarmonyCompassSVG. It ends just before `export default function HarmonyCompassScreen() {`
# Let's search backwards from end_idx for `};`
comp_end = text.rfind("};", start_idx, end_idx)

if comp_end == -1:
    print("Could not find end of component")
    exit(1)

new_compass = """const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim }: any) => {
  const r = size / 2;
  const center = r;

  // 24-point intricate star
  const generateIntricateStar = (outerR: number, innerR: number, points: number = 24) => {
    let d = '';
    const angleStep = (Math.PI * 2) / points;
    for (let i = 0; i < points; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const midAngle = (i + 0.5) * angleStep - Math.PI / 2;
      const nextAngle = (i + 1) * angleStep - Math.PI / 2;

      const x1 = center + innerR * Math.cos(angle);
      const y1 = center + innerR * Math.sin(angle);
      const x2 = center + outerR * Math.cos(midAngle);
      const y2 = center + outerR * Math.sin(midAngle);
      const x3 = center + innerR * Math.cos(nextAngle);
      const y3 = center + innerR * Math.sin(nextAngle);

      if (i === 0) d += `M ${x1} ${y1} `;
      d += `L ${x2} ${y2} L ${x3} ${y3} `;
    }
    return d + 'Z';
  };

  const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);
  const rotInterpolate = compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });
  // Make the inner ring rotate in the opposite direction for a cool mechanical effect
  const innerRotInterpolate = compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['18000deg', '-18000deg'] });

  const GOLD_PRIMARY = "#E6C27A";
  const GOLD_SECONDARY = "#C9A24B";
  const GLASS_BG = "rgba(255,255,255,0.03)";

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      
      {/* ── Background Aura ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: breathingScaleAnim }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="premiumAura" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={GOLD_SECONDARY} stopOpacity="0.15" />
              <Stop offset="70%" stopColor={GOLD_SECONDARY} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <AnimatedSvgCircle cx={center} cy={center} r={r} fill="url(#premiumAura)" opacity={pulseAnim as any} />
        </Svg>
      </Animated.View>

      {/* ── Outer Bezel (Slow Rotation) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rotInterpolate }] }}>
        <View style={{
          width: size * 0.98, height: size * 0.98, borderRadius: size / 2,
          borderWidth: 1, borderColor: "rgba(230,194,122,0.15)",
          shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20,
          backgroundColor: GLASS_BG, elevation: 10
        }} />
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
          <Defs>
            <SvgLinearGradient id="bezelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.8" />
              <Stop offset="25%" stopColor={GOLD_SECONDARY} stopOpacity="0.3" />
              <Stop offset="50%" stopColor={GOLD_PRIMARY} stopOpacity="0.6" />
              <Stop offset="75%" stopColor={GOLD_SECONDARY} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={GOLD_PRIMARY} stopOpacity="0.8" />
            </SvgLinearGradient>
            
            <SvgLinearGradient id="innerBezel" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFF" stopOpacity="0.2" />
              <Stop offset="50%" stopColor="#FFF" stopOpacity="0.0" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0.3" />
            </SvgLinearGradient>
          </Defs>

          {/* Thick Outer Ring */}
          <Circle cx={center} cy={center} r={r * 0.9} fill="none" stroke="url(#bezelGradient)" strokeWidth={3} />
          {/* Inner Accent Ring */}
          <Circle cx={center} cy={center} r={r * 0.88} fill="none" stroke="url(#innerBezel)" strokeWidth={1} opacity={0.6} />
          {/* Dotted Tick Marks */}
          <Circle cx={center} cy={center} r={r * 0.83} fill="none" stroke={GOLD_SECONDARY} strokeWidth={1} strokeDasharray="2, 6" opacity={0.5} />
          
          {/* 8-Point Compass Marks */}
          {[...Array(8)].map((_, i) => {
            const angle = (i * 45) * (Math.PI / 180);
            const x1 = center + (r * 0.9) * Math.cos(angle);
            const y1 = center + (r * 0.9) * Math.sin(angle);
            const x2 = center + (r * 0.8) * Math.cos(angle);
            const y2 = center + (r * 0.8) * Math.sin(angle);
            const isCardinal = i % 2 === 0;
            return (
              <Line key={`tick_${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isCardinal ? GOLD_PRIMARY : GOLD_SECONDARY} strokeWidth={isCardinal ? 2 : 1} opacity={isCardinal ? 0.9 : 0.5} />
            );
          })}
        </Svg>
        
        {/* Direction Labels */}
        {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir, i) => {
          const rad = (i * 45 - 90) * (Math.PI / 180);
          const radius = r * 0.72;
          const x = radius * Math.cos(rad);
          const y = radius * Math.sin(rad);
          const isCardinal = i % 2 === 0;
          return (
            <View key={i} style={{ position: 'absolute', transform: [{ translateX: x }, { translateY: y }] }}>
              <Text style={{
                color: isCardinal ? GOLD_PRIMARY : GOLD_SECONDARY,
                fontSize: isCardinal ? 14 : 10,
                fontWeight: isCardinal ? '900' : '600',
                fontFamily: FONTS.serif,
                letterSpacing: 1,
                opacity: isCardinal ? 1 : 0.6,
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4
              }}>{dir}</Text>
            </View>
          );
        })}
      </Animated.View>

      {/* ── Middle Intricate Yantra Layer (Counter-Rotation) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: innerRotInterpolate }, { scale: breathingScaleAnim }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id="yantraGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0.1" />
            </SvgLinearGradient>
            <SvgLinearGradient id="yantraGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.7" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0.2" />
            </SvgLinearGradient>
          </Defs>

          {/* 24-point Sri-Yantra Inspired Gear */}
          <Path d={generateIntricateStar(r * 0.6, r * 0.5, 24)} fill="url(#yantraGold)" stroke="url(#yantraGlow)" strokeWidth={1} />
          <Path d={generateIntricateStar(r * 0.55, r * 0.45, 12)} fill="none" stroke="url(#yantraGlow)" strokeWidth={1.5} opacity={0.8} />
          
          {/* Concentric Inner Circles */}
          <Circle cx={center} cy={center} r={r * 0.42} fill="none" stroke={GOLD_SECONDARY} strokeWidth={1} opacity={0.3} />
          <Circle cx={center} cy={center} r={r * 0.38} fill="none" stroke={GOLD_PRIMARY} strokeWidth={0.5} strokeDasharray="4, 4" opacity={0.6} />
        </Svg>
      </Animated.View>

      {/* ── Inner Brahmasthan & Core ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: innerRotInterpolate }] }}>
        <View style={{
          width: r * 0.6, height: r * 0.6,
          backgroundColor: "rgba(10,10,15,0.8)",
          borderRadius: r * 0.3,
          borderWidth: 1, borderColor: "rgba(201,162,75,0.3)",
          alignItems: 'center', justifyContent: 'center',
          shadowColor: GOLD_PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10,
        }}>
          <Svg width={r * 0.6} height={r * 0.6} viewBox={`0 0 ${r * 0.6} ${r * 0.6}`} style={{ position: 'absolute' }}>
             {/* Intersecting Squares for Vastu Purusha Mandala */}
             <Rect
                x={r * 0.15} y={r * 0.15} width={r * 0.3} height={r * 0.3}
                fill="none" stroke={GOLD_PRIMARY} strokeWidth={1} opacity={0.7}
             />
             <Rect
                x={r * 0.15} y={r * 0.15} width={r * 0.3} height={r * 0.3}
                fill="none" stroke={GOLD_PRIMARY} strokeWidth={1} opacity={0.7}
                transform={`rotate(45 ${r * 0.3} ${r * 0.3})`}
             />
             {/* Center Jewel */}
             <Circle cx={r * 0.3} cy={r * 0.3} r={4} fill={GOLD_PRIMARY} />
             <Circle cx={r * 0.3} cy={r * 0.3} r={12} fill="none" stroke={GOLD_PRIMARY} strokeWidth={0.5} opacity={0.5} />
          </Svg>
        </View>
      </Animated.View>

      {/* ── Active Highlight Overlay (Dynamic Vastu Energy Flow) ── */}
      {activeZoneData !== null && (
        <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: rotInterpolate }, { scale: breathingScaleAnim }] }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {activeZoneData.zones.map((zone: any, index: number) => {
              const angle = zone.angle;
              return (
                <G key={index} transform={`rotate(${angle - 90} ${center} ${center})`}>
                  <Defs>
                    <SvgLinearGradient id={`beamGlow-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                      <Stop offset="50%" stopColor={COLORS.saffron} stopOpacity="0.8" />
                      <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </SvgLinearGradient>
                  </Defs>
                  
                  {/* Energy Beam */}
                  <Path
                    d={`M ${center} ${center - r * 0.1} L ${center + r * 0.95} ${center - 8} A ${r * 0.95} ${r * 0.95} 0 0 1 ${center + r * 0.95} ${center + 8} Z`}
                    fill={`url(#beamGlow-${index})`}
                    opacity={0.6}
                  />
                  
                  {/* Sharp Vector Line */}
                  <Line x1={center + r * 0.2} y1={center} x2={center + r * 0.92} y2={center} stroke={COLORS.saffron} strokeWidth={2.5} strokeLinecap="round" />
                  
                  {/* Glowing Node */}
                  <Circle cx={center + r * 0.92} cy={center} r={4} fill="#FFF" shadowColor={COLORS.saffron} shadowRadius={5} shadowOpacity={1} />
                  <Circle cx={center + r * 0.92} cy={center} r={8} fill="none" stroke={COLORS.saffron} strokeWidth={2} opacity={0.9} />
                  
                  <SvgText
                    x={center + r * 0.75}
                    y={center - 10}
                    fill="#FFF"
                    fontSize={11}
                    fontFamily={FONTS.sans}
                    fontWeight="800"
                    textAnchor="middle"
                    transform={`rotate(${angle > 90 && angle < 270 ? 180 : 0} ${center + r * 0.75} ${center - 10})`}
                  >
                    {zone.sanskrit}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
"""

final_text = text[:start_idx] + new_compass + "\n\n" + text[comp_end+2:]

# Now replace particles
import re
final_text = re.sub(r'\{/\*\s*Gyroscope Stardust Particles\s*\*/\}.*?</Animated\.View>', '', final_text, flags=re.DOTALL)

with open("app/(tabs)/walk.tsx", "w") as f:
    f.write(final_text)

print("Done")
