import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { controlSize, environment, glassEffect, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
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
    <Host matchContents={{ vertical: true }} style={style} ignoreSafeArea="all">
      <Picker
        selection={selectedIndex}
        onSelectionChange={onChange}
        modifiers={[
          pickerStyle('segmented'),
          controlSize('large'),
          environment('colorScheme', scheme),
          glassEffect({ glass: { variant: 'regular' }, shape: 'capsule' }),
        ]}
        label="">
        {values.map((label, index) => (
          <Text key={index} modifiers={[tag(index)]}>
            {label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
