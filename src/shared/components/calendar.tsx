import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';

import { ICON_STROKE, Row } from '@/shared/components/ui';
import { addMonths, daysBetween, fmt, monthEnd, parseDay, today, WEEKDAY_INITIALS } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

const GAP = 4;

export interface DayMark {
  /** Shades the whole cell, e.g. by how big the day's value was. */
  fill?: { color: string; opacity: number };
  /** Small dots under the day number; the first three are drawn. */
  dots?: string[];
}

/**
 * One month, Monday first. Swipe or use the arrows to change month within minMonth…maxMonth.
 * Days after today are muted and can't be selected.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  minMonth,
  maxMonth,
  selected,
  onSelect,
  marks,
}: {
  /** First day of the month shown. */
  month: string;
  onMonthChange: (month: string) => void;
  minMonth: string;
  maxMonth: string;
  selected: string;
  onSelect: (day: string) => void;
  marks: Map<string, DayMark>;
}) {
  const p = useTheme();
  const [width, setWidth] = useState(0);
  const t = today();
  const canBack = month > minMonth;
  const canForward = month < maxMonth;
  const back = () => canBack && onMonthChange(addMonths(month, -1));
  const forward = () => canForward && onMonthChange(addMonths(month, 1));

  const swipe = Gesture.Race(
    Gesture.Fling().direction(Directions.RIGHT).runOnJS(true).onEnd(back),
    Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(forward),
  );

  const size = width ? (width - 6 * GAP) / 7 : 0;
  const lead = (parseDay(month).getDay() + 6) % 7;
  const days = daysBetween(month, monthEnd(month));

  return (
    <View className="gap-3">
      <Row className="items-center justify-between">
        <Pressable onPress={back} disabled={!canBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month" className="p-1" style={{ opacity: canBack ? 1 : 0.3 }}>
          <ChevronLeft size={20} color={p.text} strokeWidth={ICON_STROKE} />
        </Pressable>
        <Text className="font-body-bold text-label text-ink">{fmt.monthKey(month)}</Text>
        <Pressable onPress={forward} disabled={!canForward} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next month" className="p-1" style={{ opacity: canForward ? 1 : 0.3 }}>
          <ChevronRight size={20} color={p.text} strokeWidth={ICON_STROKE} />
        </Pressable>
      </Row>
      <Row style={{ gap: GAP }}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Text key={i} className="flex-1 text-center font-body-semibold text-[11px] text-muted">
            {d}
          </Text>
        ))}
      </Row>
      <GestureDetector gesture={swipe}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} className="flex-row flex-wrap" style={{ gap: GAP }}>
          {size > 0 && (
            <>
              {Array.from({ length: lead }, (_, i) => (
                <View key={`lead-${i}`} style={{ width: size, height: size }} />
              ))}
              {days.map((day) => {
                const mark = marks.get(day);
                const ahead = day > t;
                const isSelected = day === selected;
                const strong = mark?.fill && mark.fill.opacity > 0.65;
                return (
                  <Pressable
                    key={day}
                    disabled={ahead}
                    onPress={() => onSelect(day)}
                    accessibilityRole="button"
                    accessibilityLabel={`${fmt.dowShort(day)}${mark ? ', logged' : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    className="items-center justify-center rounded-md"
                    style={{ width: size, height: size, borderWidth: isSelected ? 2 : 0, borderColor: p.text }}>
                    {mark?.fill ? (
                      <View className="absolute inset-0 rounded-md" style={{ backgroundColor: mark.fill.color, opacity: mark.fill.opacity }} />
                    ) : !ahead ? (
                      <View className="absolute inset-0 rounded-md bg-chip" />
                    ) : null}
                    <Text
                      className={day === t ? 'font-body-bold text-[13px]' : 'font-body text-[13px]'}
                      style={{ color: strong ? p.onAccent : ahead ? p.textMuted : p.text }}>
                      {parseDay(day).getDate()}
                    </Text>
                    {mark?.dots?.length ? (
                      <Row className="absolute gap-[3px]" style={{ bottom: Math.max(3, size * 0.1) }}>
                        {mark.dots.slice(0, 3).map((c, i) => (
                          <View key={i} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </Row>
                    ) : null}
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}
