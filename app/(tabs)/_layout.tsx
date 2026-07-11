import { Tabs, useRouter, usePathname } from "expo-router";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Modal,
  ImageBackground,
  StatusBar,
  ScrollView,
  Image,
  LayoutAnimation,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSoundPlayer, MAX_MIX } from "@/lib/soundPlayerContext";
import { ALL_SLEEP_SOUNDS } from "@/lib/sleepSoundsData";
import { useBgContext } from "@/lib/bgContext";
import { useRef, useEffect, useState, useCallback } from "react";

function VeenaIcon({
  size = 23,
  color = "#7A9A7A",
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Main resonating gourd body */}
      <Circle
        cx="16"
        cy="16"
        r="6"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={filled ? 0 : 1.6}
      />
      {/* Neck — diagonal from body toward top-left */}
      <Path
        d="M11.8 11.8 L5.2 5.2"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Secondary resonating gourd (kudukku) at top-left */}
      <Circle
        cx="3.5"
        cy="3.5"
        r="2.8"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={filled ? 0 : 1.5}
      />
      {/* Strings — visible only in outline (inactive) state */}
      {!filled && (
        <>
          <Path
            d="M12.8 13.5 L6.5 7.2"
            stroke={color}
            strokeWidth="0.55"
            opacity="0.55"
            fill="none"
          />
          <Path
            d="M14 14.5 L7.7 8.2"
            stroke={color}
            strokeWidth="0.55"
            opacity="0.55"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
}

function SonicSunriseIcon({
  size = 23,
  color = "#7A9A7A",
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          {/* Sun Rays */}
          <Path d="M12 2V4M18.5 4.5L17 6M5.5 4.5L7 6M22 11H20M2 11H4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          {/* Sun */}
          <Circle cx="12" cy="11" r="5" fill={color} />
          {/* Mountains */}
          <Path d="M2 21L9 11L16 21H2Z" fill={color} opacity="0.6" />
          <Path d="M-1 21L6 12L13 21H-1Z" fill={color} />
          <Path d="M11 21L18 12L25 21H11Z" fill={color} />
        </>
      ) : (
        <>
          {/* Sun Rays */}
          <Path d="M12 2V4M18.5 4.5L17 6M5.5 4.5L7 6M22 11H20M2 11H4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          {/* Sun Half Circle */}
          <Path d="M7 11.5A5 5 0 1 1 17 11.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          {/* Background Mountain Peak */}
          <Path d="M2 21L9 11L13 16.7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Foreground Mountains */}
          <Path d="M-1 21L6 12L13 21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M11 21L18 12L25 21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Horizon Base */}
          <Path d="M-1 21H25" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtTimer = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

const TIMER_OPTIONS = [
  { label: "21 min", secs: 21 * 60 },
  { label: "30 min", secs: 30 * 60 },
  { label: "45 min", secs: 45 * 60 },
  { label: "1 hr", secs: 60 * 60 },
  { label: "2 hr", secs: 120 * 60 },
];

function FullScreenPlayer() {
  const {
    playingMeta,
    mixedSounds,
    isPaused,
    sessionSecs,
    togglePause,
    stopSound,
    changeTimer,
    addToMix,
    removeFromMix,
    showFullPlayer,
    closeFullPlayer,
  } = useSoundPlayer();

  const [showMixPicker, setShowMixPicker] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [mixCat, setMixCat] = useState<string>("All");

  // Pre-warm the image cache the moment a new sound starts playing so the
  // full-screen background appears instantly when the player is opened.
  useEffect(() => {
    if (playingMeta?.imageUri) {
      Image.prefetch(playingMeta.imageUri).catch(() => {});
    }
  }, [playingMeta?.imageUri]);

  if (!playingMeta || !showFullPlayer) return null;

  const totalSecs =
    TIMER_OPTIONS.find((t) => t.secs >= sessionSecs)?.secs ??
    TIMER_OPTIONS[3].secs;
  const progress = Math.max(0, Math.min(1, sessionSecs / totalSecs));
  const bgImage = playingMeta.imageUri;
  const bgSource =
    playingMeta.imageBundled ?? (bgImage ? { uri: bgImage } : undefined);

  const cats = ["All", "Nature", "Meditations", "Birds", "Ragas", "World"];
  const palette =
    mixCat === "All"
      ? ALL_SLEEP_SOUNDS
      : ALL_SLEEP_SOUNDS.filter((s) => s.cat === mixCat);
  const mixIds = new Set(mixedSounds.map((s) => s.id));

  return (
    <Modal
      visible={showFullPlayer}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeFullPlayer}
    >
      <ImageBackground
        source={bgSource}
        style={FP.screen}
        imageStyle={FP.bgImage}
        resizeMode="cover"
      >
        {/* Very subtle vignette — keeps image dominant */}
        <LinearGradient
          colors={["rgba(0,0,0,0.18)", "transparent", "rgba(0,0,0,0.55)"]}
          style={StyleSheet.absoluteFillObject}
        />
        <StatusBar hidden />

        {/* ── TOP: back chevron + sound name ── */}
        <View style={FP.topRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              closeFullPlayer();
            }}
            style={FP.chevronBtn}
          >
            <Ionicons
              name="chevron-down"
              size={22}
              color="rgba(255,255,255,0.80)"
            />
          </TouchableOpacity>
          <Text style={FP.soundName} numberOfLines={1}>
            {mixedSounds.length > 1
              ? mixedSounds.map((s) => s.emoji).join("  ")
              : playingMeta.label}
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              stopSound(true);
            }}
            style={FP.chevronBtn}
          >
            <Ionicons
              name="stop-circle-outline"
              size={22}
              color="rgba(255,255,255,0.55)"
            />
          </TouchableOpacity>
        </View>

        {/* ── CENTER: + add button ── */}
        <View style={FP.centerArea}>
          {mixedSounds.length > 1 && (
            <View style={FP.mixChips}>
              {mixedSounds.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removeFromMix(s.id);
                  }}
                  style={[
                    FP.mixChip,
                    {
                      borderColor: s.color + "80",
                      backgroundColor: s.color + "20",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
                  <Text style={[FP.mixChipLabel, { color: s.color }]}>
                    {s.label}
                  </Text>
                  <Ionicons name="close" size={11} color={s.color + "CC"} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {mixedSounds.length < MAX_MIX && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowMixPicker(true);
              }}
              style={FP.addBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={32} color="rgba(255,255,255,0.90)" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── BOTTOM: controls + progress ── */}
        <View style={FP.bottomArea}>
          <View style={FP.controlRow}>
            {/* Pause / Play */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                togglePause();
              }}
              style={FP.circleBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isPaused ? "play" : "pause"}
                size={26}
                color="rgba(255,255,255,0.92)"
              />
            </TouchableOpacity>

            {/* Timer */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTimerPicker(true);
              }}
              style={FP.circleBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name="timer-outline"
                size={26}
                color="rgba(255,255,255,0.92)"
              />
            </TouchableOpacity>
          </View>

          {/* Thin progress bar */}
          <View style={FP.progressTrack}>
            <View
              style={[FP.progressFill, { width: `${progress * 100}%` as any }]}
            />
            <View
              style={[FP.progressDot, { left: `${progress * 100}%` as any }]}
            />
          </View>
          <Text style={FP.timeLeftTxt}>{fmtTimer(sessionSecs)}</Text>
        </View>
      </ImageBackground>

      {/* ── Mix Picker Sheet ── */}
      <Modal
        visible={showMixPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMixPicker(false)}
      >
        <View style={FP.sheetBackdrop}>
          <View style={FP.sheet}>
            <View style={FP.sheetHandle} />
            <Text style={FP.sheetTitle}>
              Add to Mix{" "}
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                {mixedSounds.length}/{MAX_MIX}
              </Text>
            </Text>
            {/* Category tabs */}
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {cats.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setMixCat(c)}
                  style={[FP.catTab, mixCat === c && FP.catTabActive]}
                >
                  <Text
                    style={[FP.catTabTxt, mixCat === c && { color: "#fff" }]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Sound list */}
            <ScrollView
              style={{ maxHeight: 260 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  paddingBottom: 8,
                }}
              >
                {palette.map((s) => {
                  const inMix = mixIds.has(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        if (inMix) {
                          removeFromMix(s.id);
                        } else if (mixedSounds.length < MAX_MIX) {
                          addToMix(s);
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[
                        FP.soundPill,
                        {
                          borderColor: inMix
                            ? s.color + "AA"
                            : "rgba(255,255,255,0.12)",
                          backgroundColor: inMix
                            ? s.color + "22"
                            : "rgba(255,255,255,0.05)",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                      <Text
                        style={[
                          FP.soundPillLabel,
                          { color: inMix ? s.color : "rgba(255,255,255,0.65)" },
                        ]}
                      >
                        {s.label}
                      </Text>
                      {inMix && (
                        <Ionicons name="checkmark" size={12} color={s.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowMixPicker(false)}
              style={FP.sheetDoneBtn}
            >
              <Text style={FP.sheetDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Timer Picker Sheet ── */}
      <Modal
        visible={showTimerPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimerPicker(false)}
      >
        <View style={FP.sheetBackdrop}>
          <View style={FP.sheet}>
            <View style={FP.sheetHandle} />
            <Text style={FP.sheetTitle}>Sleep Timer</Text>
            {TIMER_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.secs}
                onPress={() => {
                  changeTimer(t.secs);
                  setShowTimerPicker(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={FP.timerRow}
              >
                <Text style={FP.timerLabel}>{t.label}</Text>
                {sessionSecs <= t.secs && sessionSecs > t.secs - 60 && (
                  <Ionicons name="checkmark" size={16} color="#60a5fa" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const FP = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#04040E" },
  bgImage: { opacity: 1.0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  chevronBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  soundName: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  mixChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  mixChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mixChipLabel: { fontSize: 12, fontWeight: "700" },
  addBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.70)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomArea: { paddingHorizontal: 40, paddingBottom: 52 },
  controlRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    marginBottom: 36,
  },
  circleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 1,
    marginBottom: 10,
    position: "relative",
    overflow: "visible",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 1,
  },
  progressDot: {
    position: "absolute",
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginLeft: -5,
  },
  timeLeftTxt: {
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0D0D1C",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 16,
  },
  catTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  catTabActive: {
    borderColor: "rgba(255,255,255,0.60)",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  catTabTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.45)",
  },
  soundPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  soundPillLabel: { fontSize: 12, fontWeight: "700" },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  timerLabel: { fontSize: 16, fontWeight: "700", color: "#fff" },
  sheetDoneBtn: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  sheetDoneTxt: { fontSize: 14, fontWeight: "900", color: "#fff" },
});

function WaveformBars({ color, active }: { color: string; active: boolean }) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.7)).current;
  const bar3 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!active) {
      Animated.parallel([
        Animated.timing(bar1, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(bar2, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(bar3, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    const animate = (
      bar: Animated.Value,
      min: number,
      max: number,
      dur: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: max,
            duration: dur,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: min,
            duration: dur,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    animate(bar1, 0.25, 1.0, 340);
    animate(bar2, 0.15, 0.9, 260);
    animate(bar3, 0.3, 0.8, 410);
    return () => {
      bar1.stopAnimation();
      bar2.stopAnimation();
      bar3.stopAnimation();
    };
  }, [active]);

  const barStyle = (anim: Animated.Value) => ({
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: color,
    opacity: 0.9,
    transform: [{ scaleY: anim }],
  });

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 16 }}
    >
      <Animated.View style={barStyle(bar1)} />
      <Animated.View style={barStyle(bar2)} />
      <Animated.View style={barStyle(bar3)} />
    </View>
  );
}

function GlobalPlayerBar() {
  const router = useRouter();
  const {
    playingId,
    isPaused,
    sessionSecs,
    playingMeta,
    mixedSounds,
    togglePause,
    stopSound,
    openReelsOrPlayer,
  } = useSoundPlayer();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  // Persist last-known meta so the bar never flickers during sound transitions
  const lastMetaRef = useRef<typeof playingMeta>(null);
  if (playingMeta) lastMetaRef.current = playingMeta;
  const displayMeta = playingMeta ?? lastMetaRef.current;
  const [rendered, setRendered] = useState(false);

  const playingIdRef = useRef(playingId);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  useEffect(() => {
    if (playingId) {
      LayoutAnimation.configureNext({
        duration: 400,
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
      setRendered(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 120,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !playingIdRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setRendered(false);
        }
      });
    }
  }, [playingId]);

  useEffect(() => {
    if (!playingId || isPaused) {
      glowAnim.setValue(0.4);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.0,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
    return () => glowAnim.stopAnimation();
  }, [playingId, isPaused]);

  if (!rendered || !displayMeta) return null;

  const isMix = mixedSounds.length > 1;
  const label = isMix
    ? mixedSounds.map((s) => s.emoji).join(" ")
    : displayMeta.label;
  const subLine = isPaused
    ? "Paused"
    : `${fmtTimer(sessionSecs)}`;
  const accentColor = displayMeta.color || "#00e5ff"; // default electric blue

  return (
    <Animated.View
      style={[
        GP.wrap,
        { 
          transform: [{ translateY: slideAnim }],
          shadowColor: accentColor,
          shadowOpacity: glowAnim,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          borderColor: accentColor,
        }
      ]}
    >
      <LinearGradient
        colors={[`${accentColor}30`, "rgba(5,7,12,0.85)"]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={GP.grad}
      >
        {/* Blur background for true glassmorphism on iOS/new Android */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
        {/* Left — emoji art square */}
        <TouchableOpacity
          style={GP.bodyTap}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            openReelsOrPlayer();
            router.navigate("/(tabs)/sleep");
          }}
          activeOpacity={0.8}
        >
          <View style={GP.emojiBox}>
            <Text style={GP.emojiTxt}>{displayMeta.emoji}</Text>
          </View>

          {/* Info */}
          <View style={GP.infoCol}>
            <Text style={GP.name} numberOfLines={1}>
              {label}
            </Text>
            <Text style={GP.sub} numberOfLines={1}>
              {subLine}
            </Text>
          </View>

          {/* Waveform */}
          <View style={GP.waveWrap}>
            <WaveformBars
              color={accentColor}
              active={!isPaused && !!playingId}
            />
          </View>
        </TouchableOpacity>

        {/* Pause / Play */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            togglePause();
          }}
          style={GP.circleBtn}
        >
          <Ionicons
            name={isPaused ? "play" : "pause"}
            size={18}
            color="#FFF"
            style={{ marginLeft: isPaused ? 2 : 0 }}
          />
        </TouchableOpacity>

        {/* Stop/Close */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            stopSound(true);
          }}
          style={GP.stopBtn}
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const GP = StyleSheet.create({
  wrap: {
    marginHorizontal: 32, // slimmer width
    marginBottom: 24, // floating a bit higher
    borderRadius: 99, // fully round like a wire
    overflow: "hidden",
    borderWidth: 1.5, // strong electric wire border
    backgroundColor: 'rgba(5,7,12,0.85)',
    elevation: 20,
  },
  accentLine: {
    height: 0,
    width: "100%",
  },
  grad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8, // very slim
    gap: 10,
  },
  bodyTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emojiBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiTxt: { fontSize: 16 },
  infoCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
    fontFamily: "Nunito_700Bold",
  },
  sub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    fontFamily: "Nunito_500Medium",
    letterSpacing: 0,
  },
  waveWrap: { marginRight: 6 },
  circleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});

const TABS = [
  {
    name: "index",
    route: "/(tabs)",
    iconOn: "sunny" as const,
    icon: "sunny-outline" as const,
    label: "Daily",
    color: "#F5820A",
  },
  {
    name: "alarms",
    route: "/(tabs)/alarms",
    iconOn: "alarm" as const,
    icon: "alarm-outline" as const,
    label: "Heal Alarm",
    color: "#f97316",
  },
  {
    name: "sleep",
    route: "/(tabs)/sleep",
    iconOn: "moon" as const,
    icon: "moon-outline" as const,
    label: "Nāda",
    color: "#60a5fa",
  },
  {
    name: "walk",
    route: "/(tabs)/walk",
    iconOn: "footsteps" as const,
    icon: "footsteps-outline" as const,
    label: "Naad Steps",
    color: "#34d399",
  },
];

function getSleepTabLabel(h: number): string {
  if (h >= 4 && h < 9) return "Morning";
  if (h >= 9 && h < 14) return "Focus";
  if (h >= 14 && h < 18) return "Restore";
  if (h >= 18 && h < 22) return "Wind Down";
  return "Sleep";
}

function getTimeTabIcon(tabName: string, h: number, focused: boolean): string {
  const isDawn = h >= 4 && h < 6;
  const isMorning = h >= 6 && h < 10;
  const isMidday = h >= 10 && h < 14;
  const isAfternoon = h >= 14 && h < 18;
  const isEvening = h >= 18 && h < 22;

  if (tabName === "index") {
    if (focused) {
      if (isMorning || isMidday) return "sunny";
      if (isAfternoon) return "partly-sunny";
      if (isEvening) return "cloudy-night";
      if (isDawn) return "eye";
      return "star";
    }
    if (isMorning || isMidday) return "sunny-outline";
    if (isAfternoon) return "partly-sunny-outline";
    if (isEvening) return "cloudy-night-outline";
    if (isDawn) return "eye-outline";
    return "star-outline";
  }

  if (tabName === "alarms") {
    if (focused) {
      if (isDawn || isMorning) return "alarm";
      if (isMidday) return "notifications";
      if (isAfternoon) return "notifications";
      if (isEvening) return "alarm";
      return "alarm";
    }
    if (isDawn || isMorning) return "alarm-outline";
    if (isMidday) return "notifications-outline";
    if (isAfternoon) return "notifications-outline";
    if (isEvening) return "alarm-outline";
    return "alarm-outline";
  }

  if (tabName === "sleep") {
    if (focused) {
      if (isDawn || isMorning) return "leaf";
      if (isMidday) return "cafe";
      if (isAfternoon) return "body";
      if (isEvening) return "cloudy-night";
      return "moon";
    }
    if (isDawn || isMorning) return "leaf-outline";
    if (isMidday) return "cafe-outline";
    if (isAfternoon) return "body-outline";
    if (isEvening) return "cloudy-night-outline";
    return "moon-outline";
  }

  if (tabName === "walk") {
    if (focused) {
      if (isDawn || isMorning) return "footsteps";
      if (isMidday) return "footsteps";
      if (isAfternoon) return "footsteps";
      if (isEvening) return "footsteps";
      return "footsteps";
    }
    return "footsteps-outline";
  }

  if (tabName === "settings") {
    if (focused) {
      if (isDawn || isMorning) return "options";
      if (isEvening) return "moon";
      return "settings";
    }
    if (isDawn || isMorning) return "options-outline";
    if (isEvening) return "moon-outline";
    return "settings-outline";
  }

  const map: Record<string, [string, string]> = {
    alarms: ["alarm", "alarm-outline"],
    walk: ["footsteps", "footsteps-outline"],
    settings: ["settings", "settings-outline"],
  };
  const [on, off] = map[tabName] ?? ["ellipse", "ellipse-outline"];
  return focused ? on : off;
}

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const { bgUri, accentColor } = useBgContext();
  const bottomPad = Math.max(Math.round(insets.bottom * 0.85), Platform.OS === "android" ? 6 : 0);
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={[
        styles.wrapper,
        { paddingBottom: bottomPad, backgroundColor: accentColor || "#050510" },
      ]}
      imageStyle={styles.wrapperBgImage}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.68)"]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <FullScreenPlayer />
      <GlobalPlayerBar />
      <View style={styles.pill}>
        {TABS.map((tab) => {
          const focused =
            path === "/" ? tab.name === "index" : path.endsWith(tab.name);
          const focusedColor = "#FFFFFF";
          const unfocusedColor = "rgba(255,255,255,0.52)";
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.navigate(tab.route as never);
              }}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.iconWrap,
                  focused && { backgroundColor: "rgba(255,255,255,0.15)" },
                ]}
              >
                {tab.name === "sleep" ? (
                  <VeenaIcon
                    size={20}
                    color={focused ? focusedColor : unfocusedColor}
                    filled={focused}
                  />
                ) : tab.name === "alarms" ? (
                  <SonicSunriseIcon
                    size={20}
                    color={focused ? focusedColor : unfocusedColor}
                    filled={focused}
                  />
                ) : (
                  <Ionicons
                    name={getTimeTabIcon(tab.name, hour, focused) as any}
                    size={20}
                    color={focused ? focusedColor : unfocusedColor}
                  />
                )}
              </View>
              {tab.name === "sleep" ? (
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: focused ? focusedColor : unfocusedColor,
                        fontSize: 11,
                        fontWeight: "900",
                        letterSpacing: 0.2,
                      },
                    ]}
                  >
                    Nāda
                  </Text>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: focused
                          ? focusedColor + "88"
                          : unfocusedColor + "88",
                        fontWeight: "500",
                        marginTop: -1,
                      },
                    ]}
                  >
                    Sounds
                  </Text>
                </View>
              ) : tab.name === "alarms" ? (
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: focused ? focusedColor : unfocusedColor,
                        fontWeight: "900",
                        letterSpacing: 0.2,
                      },
                    ]}
                  >
                    Rise
                  </Text>
                </View>
              ) : tab.name === "walk" ? (
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: focused ? focusedColor : unfocusedColor,
                        fontWeight: "900",
                        letterSpacing: 0.2,
                      },
                    ]}
                  >
                    Naad
                  </Text>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: focused
                          ? focusedColor + "88"
                          : unfocusedColor + "88",
                        fontWeight: "500",
                        marginTop: -1,
                      },
                    ]}
                  >
                    Steps
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.label,
                    {
                      color: focused ? focusedColor : unfocusedColor,
                      fontWeight: focused ? "900" : "700",
                      letterSpacing: 0.2,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ImageBackground>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
          lazy: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="alarms" />
        <Tabs.Screen name="sleep" />
        <Tabs.Screen name="walk" />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="settings" />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 4,
    zIndex: 100,
    elevation: 20,
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  wrapperBgImage: {
    opacity: 0.65,
    resizeMode: "cover",
  },
  pill: {
    flexDirection: "row",
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderTopWidth: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 0,
  },
  iconWrap: {
    width: 38,
    height: 26,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.1,
    textAlign: "center",
    lineHeight: 11,
    fontFamily: "Nunito_700Bold",
  },
});
