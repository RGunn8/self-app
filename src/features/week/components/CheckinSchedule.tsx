import DateTimePicker from '@react-native-community/datetimepicker';
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from 'react-native';

import { Row } from '@/shared/components/ui';
import { fmt } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

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
    <View className="rounded-lg bg-card px-4">
      <Pressable onPress={pickDay} accessibilityRole="button">
        <Row className="justify-between py-4">
          <Text className="font-body-semibold text-label text-muted">
            Day
          </Text>
          <Text className="font-body-semibold text-label text-ink">{fmt.dayName(day)}</Text>
        </Row>
      </Pressable>
      <View className="h-[1px] bg-divider" />
      <Row className="justify-between py-2">
        <Text className="font-body-semibold text-label text-muted">
          Time
        </Text>
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
