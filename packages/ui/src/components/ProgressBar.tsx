import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../theme';

export interface ProgressBarProps {
  /** Progresso 0–1. */
  progress: number;
  height?: number;
  color?: string;
}

/** Barra de progresso com animação suave entre valores. */
export function ProgressBar({ progress, height = 6, color }: ProgressBarProps) {
  const theme = useTheme();
  const animated = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    Animated.timing(animated, {
      toValue: clamped,
      duration: theme.duration.screen,
      useNativeDriver: false,
    }).start();
  }, [animated, clamped, theme.duration.screen]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.border.subtle,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.brand.primary,
          width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
