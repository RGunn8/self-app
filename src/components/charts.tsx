import { line as d3line } from 'd3-shape';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { formatValue, type SeriesPoint } from '@/domain/metrics';
import { fmt } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';
import { T } from './ui';

/** 12 weekly averages as a small line. Gaps break the line instead of dropping to zero. */
export function Sparkline({ values, color, width = 96, height = 36 }: { values: (number | null)[]; color: string; width?: number; height?: number }) {
  const d = useMemo(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 2) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const x = (i: number) => 3 + (i / (values.length - 1)) * (width - 6);
    const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
    return d3line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y((v) => y(v as number))(values);
  }, [values, width, height]);
  if (!d) return <View style={{ width, height }} />;
  return (
    <Svg width={width} height={height} accessibilityLabel="12-week trend">
      <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Line chart with a dashed target line and 5 x-ticks. Skipped days break the line. */
export function TrendChart({
  points,
  target,
  targetWord = 'Goal',
  unit,
  color,
  deep,
  height = 180,
}: {
  points: SeriesPoint[];
  target?: number;
  targetWord?: string;
  unit: string;
  color: string;
  deep: string;
  height?: number;
}) {
  const p = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const nums = points.map((x) => x.value).filter((v): v is number => v !== null);
  const empty = nums.length === 0;

  const geo = useMemo(() => {
    if (!width || empty) return null;
    const padL = 34;
    const padB = 22;
    const plotW = width - padL - 6;
    const plotH = height - padB - 8;
    const hi = Math.max(...nums, target ?? 0) * 1.1 || 1;
    const lo = 0;
    const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * plotH;
    const path = d3line<SeriesPoint>()
      .defined((d) => d.value !== null)
      .x((_, i) => x(i))
      .y((d) => y(d.value as number))(points);
    let last = -1;
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== null) { last = i; break; }
    const yTicks = [0, hi / 2, hi].map((v) => ({ v, y: y(v) }));
    const xIdx = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1)));
    return { x, y, path, last, yTicks, xIdx, padL, plotW };
  }, [width, empty, nums, target, points, height]);

  return (
    <View onLayout={onLayout} style={{ height, width: '100%' }} accessibilityLabel={`Trend chart in ${unit}`}>
      {empty ? (
        <View style={{ flex: 1, borderRadius: radius.md, backgroundColor: p.chip, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
          <T v="label" muted style={{ textAlign: 'center', fontFamily: 'Figtree_400Regular' }}>
            No data yet. Your chart starts with the first entry.
          </T>
        </View>
      ) : geo ? (
        <>
          <Svg width={width} height={height}>
            {geo.yTicks.map((t) => (
              <Line key={t.v} x1={geo.padL} x2={width} y1={t.y} y2={t.y} stroke={p.divider} strokeWidth={1} />
            ))}
            {target !== undefined ? (
              <Line
                x1={geo.padL}
                x2={width}
                y1={geo.y(target)}
                y2={geo.y(target)}
                stroke={deep}
                strokeWidth={1.5}
                strokeDasharray={[3, 5]}
                strokeLinecap="round"
                opacity={0.7}
              />
            ) : null}
            {geo.path ? <Path d={geo.path} stroke={color} strokeWidth={2.75} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {points.length === 1 || geo.last >= 0 ? (
              <Circle cx={geo.x(geo.last)} cy={geo.y(points[geo.last].value as number)} r={5} fill={color} stroke={p.card} strokeWidth={2.5} />
            ) : null}
            {points.map((pt, i) =>
              pt.value !== null && (i === 0 || points[i - 1].value === null) && (i === points.length - 1 || points[i + 1].value === null) ? (
                <Rect key={pt.key} x={geo.x(i) - 2.5} y={geo.y(pt.value) - 2.5} width={5} height={5} rx={2.5} fill={color} />
              ) : null,
            )}
          </Svg>
          {geo.yTicks.map((t) => (
            <T key={t.v} v="caption" muted style={{ position: 'absolute', left: 0, top: t.y - 8, fontSize: 11 }}>
              {formatValue(t.v)}
            </T>
          ))}
          {geo.xIdx.map((i, n) => (
            <T
              key={`${i}-${n}`}
              v="caption"
              muted
              style={{ position: 'absolute', top: height - 16, left: Math.max(0, Math.min(width - 44, geo.x(i) - 22)), width: 44, textAlign: 'center', fontSize: 11 }}>
              {fmt.short(points[i].key)}
            </T>
          ))}
          {target !== undefined ? (
            <T v="caption" color={deep} style={{ position: 'absolute', right: 0, top: geo.y(target) - 18, fontSize: 11, fontFamily: 'Figtree_700Bold' }}>
              {targetWord} {formatValue(target)}
            </T>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Horizontal progress bar; thickness can encode priority. */
export function Bar({ ratio, color, track, thickness = 10, label }: { ratio: number; color: string; track: string; thickness?: number; label?: string }) {
  const now = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now }}
      style={{ height: thickness, borderRadius: thickness, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${now}%`, height: '100%', borderRadius: thickness, backgroundColor: color }} />
    </View>
  );
}

/** 7 × 4 grid of the last 28 days. No streak number, by design. */
export function DotGrid({ days, color, track }: { days: { day: string; done: boolean }[]; color: string; track: string }) {
  const [w, setW] = useState(0);
  const gap = 8;
  const size = w ? (w - 6 * gap) / 7 : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {size > 0 &&
        days.map((d) => (
          <View key={d.day} style={{ width: size, height: Math.min(size, 28), borderRadius: 999, backgroundColor: d.done ? color : track }} />
        ))}
    </View>
  );
}
