import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { StyleProp, ViewStyle } from 'react-native';

type PeriodPickerProps = {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function PeriodPicker({ values, selectedIndex, onChange, style }: PeriodPickerProps) {
  return (
    <SegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      onChange={(event) => onChange(event.nativeEvent.selectedSegmentIndex)}
      appearance="dark"
      style={style}
    />
  );
}
