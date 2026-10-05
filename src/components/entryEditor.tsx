import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';

import { addDays, dayKey, fmt, parseDay, today } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';
import { Chip, Row, T } from './ui';

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
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: p.card }}>
      <Row>
        {quick.map((q) => (
          <Chip key={q.key} label={q.label} selected={dayKey(value) === q.key} onPress={() => setDay(q.key)} />
        ))}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" muted>
          Date
        </T>
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
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label" muted>
          Time
        </T>
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
