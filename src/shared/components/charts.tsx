import { line as d3line } from 'd3-shape';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { type Bucket, formatAmount, formatValue, type SeriesPoint } from '@/features/metrics/domain';
import { Row } from '@/shared/components/ui';
import { fmt, parseDay, weekdayInitial } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

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


function tickLabel(pt: SeriesPoint, bucket: Bucket, count: number): string | null {
  const d = parseDay(pt.key);
  if (bucket === 'week') return fmt.short(pt.key);
  if (count <= 7) return weekdayInitial(pt.key);
  return [1, 8, 15, 22, 29].includes(d.getDate()) ? String(d.getDate()) : null;
}

const pointLabel = (pt: SeriesPoint, bucket: Bucket) => (bucket === 'day' ? fmt.dowShort(pt.key) : fmt.span(pt.key, pt.to));

/**
 * Line chart with a dashed target line. Empty points break the line. Tapping a point shows its
 * value and date in the readout above; with nothing selected the readout shows `summary`.
 */
export function TrendChart({
  points,
  bucket,
  summary,
  pointNote,
  target,
  targetWord = 'Goal',
  unit,
  color,
  deep,
  height = 180,
}: {
  points: SeriesPoint[];
  bucket: Bucket;
  /** Readout when nothing is selected, e.g. { value: 38, caption: 'of 60 · month to date' }. */
  summary: { value: number | null; caption: string };
  /** Appended to a selected point's date, e.g. 'month to date'. */
  pointNote?: string;
  target?: number;
  targetWord?: string;
  unit: string;
  color: string;
  deep: string;
  height?: number;
}) {
  const p = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const empty = points.every((pt) => pt.value === null);
  const selectedIdx = points.findIndex((pt) => pt.key === selectedKey && pt.value !== null);
  const selected = selectedIdx >= 0 ? points[selectedIdx] : null;

  const geo = useMemo(() => {
    const nums = points.map((x) => x.value).filter((v): v is number => v !== null);
    if (!width || nums.length === 0) return null;
    const padL = 34;
    const padB = 22;
    const plotW = width - padL - 10;
    const plotH = height - padB - 8;
    const hi = Math.max(...nums, target ?? 0) * 1.1 || 1;
    const lo = 0;
    const step = points.length > 1 ? plotW / (points.length - 1) : 0;
    const x = (i: number) => padL + (points.length === 1 ? plotW / 2 : i * step);
    const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * plotH;
    // A period that isn't over yet (this week so far) is drawn apart, dashed, so it doesn't read as a drop.
    const path = d3line<SeriesPoint>()
      .defined((d) => d.value !== null && !d.partial)
      .x((_, i) => x(i))
      .y((d) => y(d.value as number))(points);
    let last = -1;
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== null && !points[i].partial) { last = i; break; }
    const partial = points.findIndex((pt) => pt.partial && pt.value !== null);
    const yTicks = [0, hi / 2, hi].map((v) => ({ v, y: y(v) }));
    const xIdx =
      bucket === 'week'
        ? [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1))))]
        : points.map((_, i) => i).filter((i) => tickLabel(points[i], bucket, points.length) !== null);
    const hit = Math.max(step, 12);
    return { x, y, path, last, partial, yTicks, xIdx, padL, hit, plotBottom: height - padB };
  }, [width, target, points, height, bucket]);

  const dot = selected ? selectedIdx : geo?.last ?? -1;

  return (
    <View className="w-full gap-2">
      <View accessibilityLiveRegion="polite">
        <Row className="items-baseline gap-1">
          <Text className="font-body-bold text-metric-lg text-ink">{formatValue(selected ? selected.value : summary.value)}</Text>
          <Text className="font-body-semibold text-label text-muted">{unit}</Text>
        </Row>
        <Text className="font-body text-caption text-muted">
          {selected ? [pointLabel(selected, bucket), selected.partial ? 'so far' : null, pointNote].filter(Boolean).join(' · ') : summary.caption}
        </Text>
      </View>
      <View onLayout={onLayout} className="w-full" style={{ height }} accessibilityLabel={`Trend chart in ${unit}`}>
        {empty ? (
          <View className="flex-1 rounded-md bg-chip items-center justify-center p-6">
            <Text className="text-label text-muted text-center font-body">
              Nothing logged in this period.
            </Text>
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
              {selected ? (
                <Line x1={geo.x(selectedIdx)} x2={geo.x(selectedIdx)} y1={8} y2={geo.plotBottom} stroke={p.divider} strokeWidth={1.5} />
              ) : null}
              {geo.path ? <Path d={geo.path} stroke={color} strokeWidth={2.75} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
              {points.map((pt, i) =>
                pt.value !== null && (i === 0 || points[i - 1].value === null) && (i === points.length - 1 || points[i + 1].value === null) ? (
                  <Rect key={pt.key} x={geo.x(i) - 2.5} y={geo.y(pt.value) - 2.5} width={5} height={5} rx={2.5} fill={color} />
                ) : null,
              )}
              {geo.partial > 0 && points[geo.partial - 1].value !== null ? (
                <Line
                  x1={geo.x(geo.partial - 1)}
                  y1={geo.y(points[geo.partial - 1].value as number)}
                  x2={geo.x(geo.partial)}
                  y2={geo.y(points[geo.partial].value as number)}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={[3, 4]}
                  strokeLinecap="round"
                  opacity={0.7}
                />
              ) : null}
              {geo.partial >= 0 ? (
                <Circle
                  cx={geo.x(geo.partial)}
                  cy={geo.y(points[geo.partial].value as number)}
                  r={4.5}
                  fill={p.card}
                  stroke={color}
                  strokeWidth={2}
                />
              ) : null}
              {dot >= 0 && !points[dot].partial ? (
                <Circle cx={geo.x(dot)} cy={geo.y(points[dot].value as number)} r={5} fill={color} stroke={p.card} strokeWidth={2.5} />
              ) : null}
            </Svg>
            {geo.yTicks.map((t) => (
              <Text key={t.v} style={{ top: t.y - 8 }} className="font-body text-muted absolute left-0 text-[11px]">
                {formatValue(t.v)}
              </Text>
            ))}
            {geo.xIdx.map((i) => (
              <Text key={points[i].key} style={{ top: height - 16, left: Math.max(0, Math.min(width - 44, geo.x(i) - 22)) }} className="font-body text-muted absolute w-11 text-center text-[11px]">
                {tickLabel(points[i], bucket, points.length)}
              </Text>
            ))}
            {target !== undefined ? (
              <Text style={[{ color: deep }, { top: geo.y(target) - 18 }]} className="absolute right-0 text-[11px] font-body-bold">
                {targetWord} {formatValue(target)}
              </Text>
            ) : null}
            {points.map((pt, i) => (
              <Pressable
                key={pt.key}
                disabled={pt.value === null}
                onPress={() => setSelectedKey((k) => (k === pt.key ? null : pt.key))}
                accessibilityRole="button"
                accessibilityLabel={`${pointLabel(pt, bucket)}, ${formatAmount(pt.value, unit)}`}
                accessibilityState={{ selected: selected?.key === pt.key }}
                className="absolute top-0"
                style={{ left: geo.x(i) - geo.hit / 2, width: geo.hit, height: geo.plotBottom }}
              />
            ))}
          </>
        ) : null}
      </View>
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
      className="overflow-hidden" style={{ height: thickness, borderRadius: thickness, backgroundColor: track }}>
      <View className="h-full" style={{ width: `${now}%`, borderRadius: thickness, backgroundColor: color }} />
    </View>
  );
}

/** 7 × 4 grid of the last 28 days. No streak number, by design. */
export function DotGrid({ days, color, track }: { days: { day: string; done: boolean }[]; color: string; track: string }) {
  const [w, setW] = useState(0);
  const gap = 8;
  const size = w ? (w - 6 * gap) / 7 : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} className="flex-row flex-wrap" style={{ gap }}>
      {size > 0 &&
        days.map((d) => (
          <View key={d.day} className="rounded-pill" style={{ width: size, height: Math.min(size, 28), backgroundColor: d.done ? color : track }} />
        ))}
    </View>
  );
}
