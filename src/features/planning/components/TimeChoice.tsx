import DateTimePicker from '@react-native-community/datetimepicker';

import { Chip, Row } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

/** "Anytime" or a specific time (HH:mm). Planning a time is optional, never required. */
export function TimeChoice({ value, onChange, fallback = '09:00' }: { value: string | null; onChange: (time: string | null) => void; fallback?: string }) {
  const p = useTheme();
  return (
    <Row className="flex-wrap">
      <Chip label="Anytime" selected={value === null} onPress={() => onChange(null)} />
      <Chip label="At a time" selected={value !== null} onPress={() => value === null && onChange(fallback)} />
      {value !== null ? (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          display="compact"
          minuteInterval={5}
          onChange={(_, d) => d && onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
          accentColor={p.accent}
          themeVariant={p.scheme}
        />
      ) : null}
    </Row>
  );
}
