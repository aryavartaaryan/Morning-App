import re

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# Replace the TherapySoundCard implementation
old_card = """const TherapySoundCard = memo(function TherapySoundCard({
  sound, isPlaying, isPaused, themeColor, onPress, cardWidth
}: {
  sound: any; isPlaying: boolean; isPaused: boolean; themeColor: string; onPress: () => void; cardWidth?: number;
}) {
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [, forceUpdate] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 15 }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 15 }).start();
  }, []);
  useEffect(() => subscribeToWarm(() => { setImgLoadFailed(false); forceUpdate(n => n + 1); }), []);

  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri = !imgBundled ? (rawUri ? getLocalSoundImageUri(rawUri) : undefined) : undefined;
  const imgSource = imgBundled ?? (imgUri ? { uri: imgUri } : undefined);
  const finalSource = imgLoadFailed ? (rawUri ? { uri: rawUri } : undefined) : imgSource;

  const cardW = cardWidth ?? Math.floor(W * 0.48);
  const cardH = cardW; // Perfectly square as requested

  // Waveform bars for playing state
  const wBar1 = useRef(new Animated.Value(3)).current;
  const wBar2 = useRef(new Animated.Value(6)).current;
  const wBar3 = useRef(new Animated.Value(4)).current;
  // Ring pulse for playing state
  const ringPulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const mk = (a: Animated.Value, lo: number, hi: number, d: number) =>
        Animated.loop(Animated.sequence([
          Animated.timing(a, { toValue: hi, duration: d, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(a, { toValue: lo, duration: d * 0.75, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
        ]));
      const lr = Animated.loop(Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(ringPulse, { toValue: 0.4, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));
      const l1 = mk(wBar1, 2, 12, 360);
      const l2 = mk(wBar2, 3, 10, 500);
      const l3 = mk(wBar3, 2, 12, 420);
      l1.start(); l2.start(); l3.start(); lr.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); lr.stop(); };
    }
    wBar1.setValue(3); wBar2.setValue(6); wBar3.setValue(4);
    ringPulse.setValue(0.5);
  }, [isPlaying, isPaused]);

  return (
    <Animated.View style={{ width: cardW, transform: [{ scale: scaleAnim }] }}>
      <GHTouchableOpacity 
        onPress={onPress} 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut} 
        activeOpacity={0.9} 
        delayPressIn={50}
        style={{ flex: 1 }}
      >
        <View style={{
          width: cardW, height: cardH, borderRadius: 0, overflow: 'hidden',
          borderWidth: isPlaying ? 1.5 : 1,
          borderColor: isPlaying ? themeColor + 'CC' : 'rgba(255,255,255,0.2)',
          backgroundColor: themeColor + '20',
          shadowColor: themeColor,
          shadowOffset: { width: 0, height: isPlaying ? 8 : 4 },
          shadowOpacity: isPlaying ? 0.7 : 0.4,
          shadowRadius: isPlaying ? 28 : 20,
          elevation: isPlaying ? 14 : 8,
        }}>
          {finalSource && (
            <Image source={finalSource} style={{ width: '100%', height: '100%', position: 'absolute' }}
              resizeMode="cover" onError={() => setImgLoadFailed(true)} />
          )}
          
          {/* Subtle color overlay */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColor, opacity: isPlaying ? 0.18 : 0.1 }]} pointerEvents="none" />
          
          {!isPlaying && (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
              <View style={{ overflow: 'hidden', borderRadius: 30 }}>
                <BlurView intensity={50} tint="light" style={{
                  flexDirection: 'row', alignItems: 'center', gap: 7,
                  paddingHorizontal: 16, paddingVertical: 10,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)',
                }}>
                  <Ionicons name="play" size={13} color="#fff" style={{ marginLeft: 2 }} />
                  <Text style={{ fontSize: 11, color: '#fff', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.5 }}>Play</Text>
                </BlurView>
              </View>
            </View>
          )}

          {/* Premium NOW PLAYING badge in top-right */}
          {isPlaying && (
            <View style={{ position: 'absolute', top: 10, right: 10, overflow: 'hidden', borderRadius: 12 }}>
              <BlurView intensity={60} tint="dark" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 }}>
                  {[wBar1, wBar2, wBar3].map((b, i) => (
                    <Animated.View key={i} style={{ width: 2.5, height: b, borderRadius: 2, backgroundColor: themeColor }} />
                  ))}
                </View>
                <Text style={{ fontSize: 8, color: '#fff', fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, textTransform: 'uppercase' }}>Now Playing</Text>
              </BlurView>
            </View>
          )}
        </View>

        {/* Text Area Below Image */}
        <View style={{ marginTop: 12, paddingHorizontal: 2 }}>
          <Text
            style={{ fontSize: 13, color: '#ffffff', fontFamily: 'Nunito_700Bold', lineHeight: 18, letterSpacing: 0.3 }}
            numberOfLines={2}
          >{sound.label}</Text>
          {sound.desc && (
            <Text
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, letterSpacing: 0.2, fontFamily: 'Nunito_400Regular', lineHeight: 15 }}
              numberOfLines={2}
            >{sound.desc}</Text>
          )}
        </View>
      </GHTouchableOpacity>
    </Animated.View>
  );
});"""

new_card = """const TherapySoundCard = memo(function TherapySoundCard({
  sound, isPlaying, isPaused, themeColor, onPress, cardWidth
}: {
  sound: any; isPlaying: boolean; isPaused: boolean; themeColor: string; onPress: () => void; cardWidth?: number;
}) {
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [, forceUpdate] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 15 }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 15 }).start();
  }, []);
  
  useEffect(() => subscribeToWarm(() => { setImgLoadFailed(false); forceUpdate(n => n + 1); }), []);

  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri = !imgBundled ? (rawUri ? getLocalSoundImageUri(rawUri) : undefined) : undefined;
  const imgSource = imgBundled ?? (imgUri ? { uri: imgUri } : undefined);
  const finalSource = imgLoadFailed ? (rawUri ? { uri: rawUri } : undefined) : imgSource;

  // Use a card width that fits roughly 2.5 cards on screen if not provided
  const defaultCardW = Math.floor(W * 0.38);
  const cardW = cardWidth ?? defaultCardW;

  // Waveform bars for playing state
  const wBar1 = useRef(new Animated.Value(3)).current;
  const wBar2 = useRef(new Animated.Value(6)).current;
  const wBar3 = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const mk = (a: Animated.Value, lo: number, hi: number, d: number) =>
        Animated.loop(Animated.sequence([
          Animated.timing(a, { toValue: hi, duration: d, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(a, { toValue: lo, duration: d * 0.75, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
        ]));
      const l1 = mk(wBar1, 2, 12, 360);
      const l2 = mk(wBar2, 3, 10, 500);
      const l3 = mk(wBar3, 2, 12, 420);
      l1.start(); l2.start(); l3.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); };
    }
    wBar1.setValue(3); wBar2.setValue(6); wBar3.setValue(4);
  }, [isPlaying, isPaused]);

  return (
    <Animated.View style={{ width: cardW, transform: [{ scale: scaleAnim }] }}>
      <GHTouchableOpacity 
        onPress={onPress} 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut} 
        activeOpacity={0.9} 
        delayPressIn={50}
        style={{ flex: 1 }}
      >
        <View style={{
          width: '100%',
          backgroundColor: isPlaying ? 'rgba(35, 40, 60, 0.85)' : 'rgba(25, 25, 35, 0.65)',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isPlaying ? themeColor : 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          paddingBottom: 14,
          shadowColor: isPlaying ? themeColor : '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isPlaying ? 0.3 : 0.15,
          shadowRadius: 12,
          elevation: isPlaying ? 8 : 4,
        }}>
          {/* Top Image Section */}
          <View style={{ padding: 6 }}>
            <View style={{ width: '100%', aspectRatio: 1.15, borderRadius: 14, overflow: 'hidden' }}>
              {finalSource ? (
                <Image source={finalSource} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setImgLoadFailed(true)} />
              ) : (
                <View style={{ width: '100%', height: '100%', backgroundColor: '#2a2a35' }} />
              )}
              
              {/* Dark Gradient Overlay for better contrast on image if needed */}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)']} style={StyleSheet.absoluteFillObject} />

              {/* Premium NOW PLAYING badge inside image */}
              {isPlaying && (
                <View style={{ position: 'absolute', top: 8, right: 8, overflow: 'hidden', borderRadius: 8 }}>
                  <BlurView intensity={70} tint="dark" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 10 }}>
                      {[wBar1, wBar2, wBar3].map((b, i) => (
                        <Animated.View key={i} style={{ width: 2, height: b, borderRadius: 1, backgroundColor: themeColor }} />
                      ))}
                    </View>
                  </BlurView>
                </View>
              )}
            </View>
          </View>

          {/* Text & Play Button Section */}
          <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
            {/* Title - Fully visible */}
            <Text
              style={{ fontSize: 13, color: isPlaying ? '#ffffff' : 'rgba(255,255,255,0.95)', fontFamily: 'Nunito_700Bold', lineHeight: 18, letterSpacing: 0.3 }}
            >{sound.label}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                {sound.desc && (
                  <Text
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.2, fontFamily: 'Nunito_400Regular', lineHeight: 15 }}
                    numberOfLines={1}
                  >{sound.desc}</Text>
                )}
              </View>
              
              {/* Small Minimalist Play/Pause Icon */}
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: isPlaying ? themeColor + '30' : 'rgba(255,255,255,0.08)',
                justifyContent: 'center', alignItems: 'center',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isPlaying ? themeColor : 'rgba(255,255,255,0.15)'
              }}>
                {isPlaying ? (
                  <Ionicons name="pause" size={14} color={themeColor} />
                ) : (
                  <Ionicons name="play" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 2 }} />
                )}
              </View>
            </View>
          </View>
        </View>
      </GHTouchableOpacity>
    </Animated.View>
  );
});"""

content = content.replace(old_card, new_card)
with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx', 'w') as f:
    f.write(content)
