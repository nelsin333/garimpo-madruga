import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { Text } from './Text';

/** Selo "Garimpo Verified" — usar apenas em peças com laudo de baixo risco. */
export function VerifiedShield({ label = 'Garimpo Verified' }: { label?: string }) {
  const theme = useTheme();
  const lime = theme.colors.brand.primary;

  return (
    <View
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.space.sm,
        backgroundColor: `${lime}1A`,
        borderWidth: 1,
        borderColor: `${lime}55`,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.space.md,
        paddingVertical: 6,
      }}
    >
      <Svg width={14} height={16} viewBox="0 0 14 16" fill="none">
        <Path
          d="M7 0L14 2.5V7.5C14 11.5 11 14.8 7 16C3 14.8 0 11.5 0 7.5V2.5L7 0Z"
          fill={lime}
        />
        <Path
          d="M4 7.8L6.2 10L10 5.5"
          stroke={theme.colors.text.onBrand}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text variant="caption" style={{ color: lime }}>
        {label}
      </Text>
    </View>
  );
}
