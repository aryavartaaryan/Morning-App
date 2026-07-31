function VastuOverlay({ heading }: { heading: Animated.Value }) {
  // normalize to 0-360
  const modHeading = Animated.modulo(Animated.add(heading, 36000), 360);

  const zones = [
    { label: "Facing North", sub: "Optimal for focus & wealth", center: 0 },
    { label: "Facing Ishan (NE)", sub: "Sacred corner for spirituality", center: 45 },
    { label: "Facing East", sub: "Optimal for morning vitality", center: 90 },
    { label: "Facing Agni (SE)", sub: "Fire element. Active energy", center: 135 },
    { label: "Facing South", sub: "Align head here for deep sleep", center: 180 },
    { label: "Facing Nairutya (SW)", sub: "Earth element. Grounding", center: 225 },
    { label: "Facing West", sub: "Optimal for evening reflection", center: 270 },
    { label: "Facing Vayu (NW)", sub: "Air element. Movement", center: 315 },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {zones.map((zone, i) => {
        // Opacity interpolation: peak at center, 0 at center ± 22.5
        // For North (center 0), handle wrap-around: peak at 0 and 360.
        let opacity;
        if (zone.center === 0) {
          opacity = modHeading.interpolate({
            inputRange: [0, 22.5, 337.5, 360],
            outputRange: [1, 0, 0, 1]
          });
        } else {
          opacity = modHeading.interpolate({
            inputRange: [zone.center - 22.5, zone.center, zone.center + 22.5],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp'
          });
        }
        return (
          <Animated.View key={i} style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', opacity }]}>
            <View style={{ transform: [{ translateY: -40 }], alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>{zone.label}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 }}>{zone.sub}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
