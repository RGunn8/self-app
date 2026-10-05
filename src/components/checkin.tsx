import DateTimePicker from '@react-native-community/datetimepicker';
import { ActionSheetIOS, Alert, Platform, Pressable, View } from 'react-native';

import { fmt } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';
import { Row, T } from './ui';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Day + time for the weekly check-in. */
export function CheckinSchedule({
  day,
  time,
  onChange,
}: {
  day: number;
  time: string;
  onChange: (patch: { checkinDay?: number; checkinTime?: string }) => void;
}) {
  const p = useTheme();
  const [h, m] = time.split(':').map(Number);
  const value = new Date();
  value.setHours(h, m, 0, 0);

  const pickDay = () => {
    const options = [...DAYS.map(fmt.dayName), 'Cancel'];
    const apply = (i: number) => i < 7 && onChange({ checkinDay: i });
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 7 }, apply);
    else Alert.alert('Day', undefined, DAYS.map((d) => ({ text: fmt.dayName(d), onPress: () => apply(d) })));
  };

  return (
    <View style={{ borderRadius: radius.lg, backgroundColor: p.card, paddingHorizontal: space.lg }}>
      <Pressable onPress={pickDay} accessibilityRole="button">
        <Row style={{ justifyContent: 'space-between', paddingVertical: space.lg }}>
          <T v="label" muted>
            Day
          </T>
          <T v="label">{fmt.dayName(day)}</T>
        </Row>
      </Pressable>
      <View style={{ height: 1, backgroundColor: p.divider }} />
      <Row style={{ justifyContent: 'space-between', paddingVertical: space.sm }}>
        <T v="label" muted>
          Time
        </T>
        <DateTimePicker
          value={value}
          mode="time"
          display="compact"
          accentColor={p.accent}
          themeVariant={p.scheme}
          onChange={(_, d) => d && onChange({ checkinTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })}
        />
      </Row>
    </View>
  );
}
