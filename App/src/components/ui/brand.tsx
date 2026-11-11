import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';

const VIEWBOX = '150 120 760 760';

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E3E6EA" />
          <Stop offset="1" stopColor="#A9B0B9" />
        </LinearGradient>
        <LinearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#34343A" />
          <Stop offset="1" stopColor="#0B0B0C" />
        </LinearGradient>
        <LinearGradient id="peak" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#DCDCD7" />
        </LinearGradient>
        <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE77F" />
          <Stop offset="0.55" stopColor="#FFD23F" />
          <Stop offset="1" stopColor="#F0AE00" />
        </LinearGradient>
      </Defs>
      <G transform="rotate(-11 512 560)">
        <Rect x="214" y="300" width="420" height="520" rx="60" fill="url(#silver)" />
      </G>
      <G transform="rotate(9 512 560)">
        <Rect x="378" y="252" width="440" height="540" rx="62" fill="url(#ink)" />
        <Rect x="381" y="255" width="434" height="534" rx="59" fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth="6" />
        <Circle cx="686" cy="414" r="44" fill="url(#gold)" />
        <Polygon
          points="422,716 554,500 633,619 686,554 774,716"
          fill="url(#peak)"
          stroke="url(#peak)"
          strokeWidth="22"
          strokeLinejoin="round"
        />
      </G>
      <Polygon
        points="770.0,146.0 799.3,209.6 868.9,217.9 817.5,265.4 831.1,334.1 770.0,299.9 708.9,334.1 722.5,265.4 671.1,217.9 740.7,209.6"
        fill="url(#gold)"
        stroke="url(#gold)"
        strokeWidth="12"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Wordmark({ size = 22, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, { gap: size * 0.3 }, style]} accessible accessibilityRole="header" accessibilityLabel="Fotolo">
      <BrandMark size={size * 1.35} />
      <ThemedText style={[styles.word, { fontSize: size, lineHeight: size * 1.2 }]}>Fotolo</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  word: {
    fontFamily: Fonts?.rounded,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
