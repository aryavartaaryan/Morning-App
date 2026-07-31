import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Circle, G, Mask } from 'react-native-svg';

export function PremiumDailyIcon({ size = 24, focused = false }: { size?: number, focused?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={focused ? "#FFD700" : "#6B7280"} />
          <Stop offset="100%" stopColor={focused ? "#FF8C00" : "#374151"} />
        </LinearGradient>
        <LinearGradient id="glare" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={focused ? 0.8 : 0.2} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={focused ? "#FFD700" : "#FFFFFF"} stopOpacity={focused ? 0.6 : 0.1} />
          <Stop offset="100%" stopColor={focused ? "#FF8C00" : "#FFFFFF"} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Ambient Glow */}
      <Circle cx="20" cy="20" r="18" fill="url(#glow)" />
      
      {/* 3D Base */}
      <Circle cx="20" cy="20" r="13" fill="url(#base)" />
      
      {/* Inner shadow/glare for 3D sphere effect */}
      <Circle cx="20" cy="19" r="12" fill="url(#glare)" />
      
      {/* Sun features */}
      <G opacity={focused ? 1 : 0.6}>
        <Path d="M20 5 V7 M20 33 V35 M5 20 H7 M33 20 H35 M9.5 9.5 L11 11 M29 29 L30.5 30.5 M9.5 30.5 L11 29 M29 11 L30.5 9.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <Circle cx="20" cy="20" r="6" fill="#FFFFFF" />
      </G>
    </Svg>
  );
}

export function PremiumSunriseIcon({ size = 24, focused = false }: { size?: number, focused?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={focused ? "#F472B6" : "#6B7280"} />
          <Stop offset="100%" stopColor={focused ? "#E11D48" : "#374151"} />
        </LinearGradient>
        <LinearGradient id="sun" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={focused ? "#FDE047" : "#D1D5DB"} />
          <Stop offset="100%" stopColor={focused ? "#F97316" : "#9CA3AF"} />
        </LinearGradient>
        <LinearGradient id="mountains" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={focused ? "#7C3AED" : "#4B5563"} />
          <Stop offset="100%" stopColor={focused ? "#312E81" : "#1F2937"} />
        </LinearGradient>
        <RadialGradient id="sunriseGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={focused ? "#F472B6" : "#FFFFFF"} stopOpacity={focused ? 0.5 : 0.1} />
          <Stop offset="100%" stopColor={focused ? "#E11D48" : "#FFFFFF"} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="glareRise" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={focused ? 0.5 : 0.15} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Glow */}
      <Circle cx="20" cy="20" r="18" fill="url(#sunriseGlow)" />
      
      {/* Container Sphere */}
      <Circle cx="20" cy="20" r="13" fill="url(#sky)" />
      
      {/* Sun inside container */}
      <G>
        <Mask id="mask">
          <Circle cx="20" cy="20" r="13" fill="#FFF" />
        </Mask>
        <G mask="url(#mask)">
          <Circle cx="20" cy="22" r="7" fill="url(#sun)" />
          {/* Mountains */}
          <Path d="M3 28 L14 16 L22 28 Z" fill="url(#mountains)" />
          <Path d="M15 28 L26 13 L37 28 Z" fill="url(#mountains)" />
        </G>
      </G>

      {/* Glare */}
      <Circle cx="20" cy="19" r="12" fill="url(#glareRise)" />
    </Svg>
  );
}

export function PremiumRhythmIcon({ size = 24, focused = false }: { size?: number, focused?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="rhythmBase" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={focused ? "#34D399" : "#6B7280"} />
          <Stop offset="100%" stopColor={focused ? "#059669" : "#374151"} />
        </LinearGradient>
        <RadialGradient id="rhythmGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={focused ? "#34D399" : "#FFFFFF"} stopOpacity={focused ? 0.5 : 0.1} />
          <Stop offset="100%" stopColor={focused ? "#059669" : "#FFFFFF"} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="rhythmGlare" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={focused ? 0.6 : 0.15} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Glow */}
      <Circle cx="20" cy="20" r="18" fill="url(#rhythmGlow)" />
      
      {/* 3D Base */}
      <Circle cx="20" cy="20" r="13" fill="url(#rhythmBase)" />
      
      {/* Inner shadow/glare for 3D sphere effect */}
      <Circle cx="20" cy="19" r="12" fill="url(#rhythmGlare)" />

      {/* Premium Yantra / Sacred Geometry icon */}
      <G opacity={focused ? 1 : 0.7}>
        <Path 
          d="M20 10 L28 24 H12 Z" 
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <Path 
          d="M20 30 L12 16 H28 Z" 
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <Circle cx="20" cy="20" r="2.5" fill="#FFFFFF" />
      </G>
    </Svg>
  );
}

export function PremiumSitarIcon({ size = 24, focused = false }: { size?: number, focused?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="sitarBase" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={focused ? "#A78BFA" : "#6B7280"} />
          <Stop offset="100%" stopColor={focused ? "#4C1D95" : "#374151"} />
        </LinearGradient>
        <RadialGradient id="sitarGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={focused ? "#A78BFA" : "#FFFFFF"} stopOpacity={focused ? 0.6 : 0.1} />
          <Stop offset="100%" stopColor={focused ? "#4C1D95" : "#FFFFFF"} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="sitarGlare" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={focused ? 0.6 : 0.15} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Glow */}
      <Circle cx="20" cy="20" r="18" fill="url(#sitarGlow)" />
      
      {/* 3D Base */}
      <Circle cx="20" cy="20" r="13" fill="url(#sitarBase)" />
      
      {/* Inner shadow/glare for 3D sphere effect */}
      <Circle cx="20" cy="19" r="12" fill="url(#sitarGlare)" />

      {/* Sitar icon */}
      <G opacity={focused ? 1 : 0.7}>
        {/* Main body gourd (bottom left) */}
        <Circle cx="15" cy="25" r="4.5" fill="#FFFFFF" opacity={0.9} />
        {/* Top gourd (top right) */}
        <Circle cx="27" cy="13" r="2.5" fill="#FFFFFF" opacity={0.9} />
        
        {/* Neck */}
        <Path 
          d="M 17 23 L 26 14" 
          stroke="#FFFFFF" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
        />
        
        {/* Frets details */}
        <Path d="M 18 20 L 20 22 M 20 18 L 22 20 M 22 16 L 24 18" stroke={focused ? "#4C1D95" : "#374151"} strokeWidth="1" />
        
        {/* Tuning pegs */}
        <Circle cx="23" cy="13" r="1.2" fill="#FFFFFF" />
        <Circle cx="25" cy="15" r="1.2" fill="#FFFFFF" />
        <Circle cx="21" cy="15" r="1.2" fill="#FFFFFF" />
      </G>
    </Svg>
  );
}
