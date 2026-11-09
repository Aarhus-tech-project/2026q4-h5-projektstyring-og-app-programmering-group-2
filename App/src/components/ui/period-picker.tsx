import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { StyleProp, useColorScheme, ViewStyle } from 'react-native';

type PeriodPickerProps = {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function PeriodPicker({ values, selectedIndex, onChange, style }: PeriodPickerProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <SegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      onChange={(event) => onChange(event.nativeEvent.selectedSegmentIndex)}
      appearance={scheme}
      style={style}
    />
  );
}
