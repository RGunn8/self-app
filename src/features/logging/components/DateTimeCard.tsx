import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, View } from 'react-native';

import { Chip, Row } from '@/shared/components/ui';
import { addDays, dayKey, fmt, parseDay, today } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

const notFuture = (d: Date) => (d.getTime() > Date.now() ? new Date() : d);

/** Quick day chips plus compact date and time pickers. maximumDate = now: no future entries. */
export function DateTimeCard({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const p = useTheme();
  const t = today();
  const quick = [
    { label: 'Today', key: t },
    { label: 'Yesterday', key: addDays(t, -1) },
    { label: fmt.short(addDays(t, -2)), key: addDays(t, -2) },
  ];
  const setDay = (key: string) => {
    const d = parseDay(key);
    d.setHours(value.getHours(), value.getMinutes());
    onChange(notFuture(d));
  };
  return (
    <View className="gap-3 p-4 rounded-lg bg-card">
      <Row>
        {quick.map((q) => (
          <Chip key={q.key} label={q.label} selected={dayKey(value) === q.key} onPress={() => setDay(q.key)} />
        ))}
      </Row>
      <Row className="justify-between">
        <Text className="font-body-semibold text-label text-muted">
          Date
        </Text>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          maximumDate={new Date()}
          onChange={(_, d) => d && onChange(d)}
          accentColor={p.accent}
          themeVariant={p.scheme}
        />
      </Row>
      <Row className="justify-between">
        <Text className="font-body-semibold text-label text-muted">
          Time
        </Text>
        <DateTimePicker
          value={value}
          mode="time"
          display="compact"
          onChange={(_, d) => d && onChange(notFuture(d))}
          accentColor={p.accent}
          themeVariant={p.scheme}
        />
      </Row>
    </View>
  );
}
