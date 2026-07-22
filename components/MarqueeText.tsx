import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TextProps, View, LayoutChangeEvent, ScrollView } from 'react-native';

interface MarqueeTextProps extends TextProps {
  children: string;
  duration?: number;
  active?: boolean;
}

export function MarqueeText({ children, duration = 5000, active = true, style, ...props }: MarqueeTextProps) {
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      scrollX.setValue(0);
      scrollX.stopAnimation();
      return;
    }

    if (textWidth > containerWidth && containerWidth > 0) {
      const distance = textWidth - containerWidth + 20; // 20px padding at the end
      
      const startAnimation = () => {
        scrollX.setValue(0);
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(scrollX, {
            toValue: -distance,
            duration: distance * 25, // speed based on distance
            useNativeDriver: true,
            easing: Easing.linear,
          }),
          Animated.delay(1000),
        ]).start(({ finished }) => {
          if (finished && active) {
            startAnimation();
          }
        });
      };

      startAnimation();

      return () => scrollX.stopAnimation();
    } else {
      scrollX.setValue(0);
    }
  }, [textWidth, containerWidth, active]);

  return (
    <View 
      style={{ overflow: 'hidden', width: '100%' }} 
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[{ flexDirection: 'row', transform: [{ translateX: scrollX }] }, !active && { width: '100%' }]}>
        <Text
          {...props}
          style={[style, active ? { flexShrink: 0 } : { flexShrink: 1, width: '100%' }]} 
          numberOfLines={active ? 1 : props.numberOfLines || 1}
          adjustsFontSizeToFit={props.adjustsFontSizeToFit !== undefined ? props.adjustsFontSizeToFit : !active}
          minimumFontScale={0.65}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {children}
        </Text>
      </Animated.View>
    </View>
  );
}
