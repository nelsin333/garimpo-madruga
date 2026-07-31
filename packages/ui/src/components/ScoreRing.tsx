import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { Text } from './Text';
import type { Risk } from './RiskBadge';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ScoreRingProps {
  /** Probabilidade 0–1. */
  score: number;
  risk: Risk;
  size?: number;
}

/** Anel de score do laudo — anima de 0 até o valor (momento "uau" do produto). */
export function ScoreRing({ score, risk, size = 148 }: ScoreRingProps) {
  const theme = useTheme();
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, score));

  const progress = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const sub = progress.addListener(({ value }) => setDisplayed(Math.round(value * 100)));
    Animated.timing(progress, {
      toValue: clamped,
      duration: theme.duration.score,
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(sub);
  }, [clamped, progress, theme.duration.score]);

  const color = theme.colors.risk[risk];

  return (
    <View
      accessibilityLabel={`Probabilidade de autenticidade: ${Math.round(clamped * 100)} por cento`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.border.subtle}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={progress.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, 0],
          })}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text variant="displayXl" style={{ color }}>
          {displayed}%
        </Text>
      </View>
    </View>
  );
}
