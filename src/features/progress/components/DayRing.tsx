import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BAND_LABEL, type DayScore } from '@/features/progress/dayScore';
import { useTheme } from '@/shared/theme';

function Ring({ fill, color, track, size }: { fill: number; color: string; track: string; size: number }) {
  const stroke = Math.max(3, size * 0.14);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {fill > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[c * fill, c]}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}

const wordFor = (s: DayScore) =>
  s.state === 'rest' ? 'Rest day' : s.state === 'paused' ? 'Paused' : s.state === 'quiet' ? 'A quiet day' : BAND_LABEL[s.band!];

/** The details behind the word, shown only when someone asks. */
function detail(s: DayScore): string {
  if (s.state === 'rest') return 'Nothing planned or logged. Rest counts too.';
  if (s.state === 'paused') return 'Your identities are paused today.';
  const parts = [
    s.planned ? `${s.kept} of ${s.planned} ${s.planned === 1 ? 'plan' : 'plans'} kept` : null,
    s.extras ? `${s.extras} extra` : null,
    !s.planned && s.votes ? `${s.votes} ${s.votes === 1 ? 'vote' : 'votes'}, your usual is ${Math.round(s.usual)}` : null,
  ].filter(Boolean);
  if (s.state === 'quiet') return parts.length ? `${parts.join(' · ')}. Still time.` : 'Still time.';
  return `${parts.join(' · ')} · ${Math.round(s.fill * 100)}`;
}

/**
 * A ring that only fills, with a word instead of a grade. Tap for the details and the number.
 * `compact` is the one-line version for the Identities header.
 */
export function DayRing({ score, compact = false, prefix }: { score: DayScore; compact?: boolean; prefix?: string }) {
  const p = useTheme();
  const [open, setOpen] = useState(false);
  const size = compact ? 18 : 30;
  const word = wordFor(score);
  const showRing = score.state === 'scored' || score.state === 'quiet';

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityLabel={`${prefix ? `${prefix}, ` : ''}${word}`}
      accessibilityHint="Shows how the day is going"
      className="flex-row items-center gap-2">
      {showRing ? <Ring fill={score.fill} color={p.accent} track={p.chip} size={size} /> : null}
      <View className="shrink">
        <Text className={compact ? 'font-body-semibold text-caption text-muted' : 'font-body-bold text-label text-ink'}>
          {prefix ? `${prefix} · ` : ''}
          {word}
        </Text>
        {open ? <Text className="font-body text-caption text-muted">{detail(score)}</Text> : null}
      </View>
    </Pressable>
  );
}
