'use client';

import { useState } from 'react';
import { cn } from '@morrowlane/ui';

/**
 * Charts built to the dataviz method:
 * - the funnel is ORDINAL: one teal hue, monotone lightness — the ramp below is
 *   validated by the palette script (lightness monotone, ΔL steps, 2:1 light end,
 *   single hue) against the white card surface;
 * - marks are thin (≤24px) with a 4px rounded data-end and a square baseline;
 * - values and labels wear ink tokens, never the series colour;
 * - every mark has a hover tooltip, and a visually-hidden table carries the data.
 * Revenue is currency, not a count, so it never shares the funnel's axis — it
 * lives in the stat row above (the one-axis rule).
 */
export const FUNNEL_RAMP = ['#57b1a0', '#2c9c8b', '#008776', '#007261', '#005c4d', '#00463a'];

export interface FunnelStage {
  label: string;
  value: number;
}

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...stages.map((stage) => stage.value));

  return (
    <div>
      <div className="space-y-2.5">
        {stages.map((stage, index) => {
          const previous = index > 0 ? stages[index - 1]!.value : null;
          const rate = previous && previous > 0 ? (stage.value / previous) * 100 : null;
          const width = Math.max(stage.value > 0 ? 1.5 : 0, (stage.value / max) * 100);

          return (
            <div
              key={stage.label}
              className="group grid grid-cols-[6.5rem_1fr] items-center gap-3"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            >
              <p className="text-right text-[12px] text-ink-soft">{stage.label}</p>
              <div className="relative h-6">
                {/* Hairline track so a zero still has a place to be. */}
                <div className="absolute inset-y-2.5 left-0 right-0 border-b border-line" aria-hidden />
                <div
                  className="anim-bar absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{
                    width: `${width}%`,
                    backgroundColor: FUNNEL_RAMP[Math.min(index, FUNNEL_RAMP.length - 1)],
                    animationDelay: `${index * 60}ms`,
                  }}
                />
                <p
                  className="absolute inset-y-0 flex items-center pl-2 text-[12px] font-medium tabular-nums text-ink"
                  style={{ left: `${width}%` }}
                >
                  {formatCount(stage.value)}
                  {rate !== null ? (
                    <span className="ml-1.5 text-[11px] font-normal text-ink-faint">{rate.toFixed(0)}%</span>
                  ) : null}
                </p>
                {hover === index ? (
                  <div className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md bg-shell px-2.5 py-1.5 text-[11px] text-shell-bright shadow-lifted">
                    {stage.label}: {stage.value.toLocaleString()}
                    {rate !== null ? ` · ${rate.toFixed(1)}% of ${stages[index - 1]!.label.toLowerCase()}` : ''}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>Funnel stages</caption>
        <tbody>
          {stages.map((stage) => (
            <tr key={stage.label}>
              <th scope="row">{stage.label}</th>
              <td>{stage.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ChannelDatum {
  label: string;
  value: number;
}

/** Magnitude comparison across channels: one hue, one series, no legend. */
export function ChannelBars({ data, unit }: { data: ChannelDatum[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="space-y-2.5">
        {sorted.map((datum, index) => {
          const width = Math.max(datum.value > 0 ? 1.5 : 0, (datum.value / max) * 100);
          return (
            <div
              key={datum.label}
              className="grid grid-cols-[6.5rem_1fr] items-center gap-3"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            >
              <p className="truncate text-right text-[12px] capitalize text-ink-soft">{datum.label}</p>
              <div className="relative h-6">
                <div className="absolute inset-y-2.5 left-0 right-0 border-b border-line" aria-hidden />
                <div
                  className="anim-bar absolute inset-y-0 left-0 rounded-r-[4px] bg-[#008776]"
                  style={{ width: `${width}%`, animationDelay: `${index * 60}ms` }}
                />
                <p
                  className="absolute inset-y-0 flex items-center pl-2 text-[12px] font-medium tabular-nums text-ink"
                  style={{ left: `${width}%` }}
                >
                  {formatCount(datum.value)}
                </p>
                {hover === index ? (
                  <div className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md bg-shell px-2.5 py-1.5 text-[11px] text-shell-bright shadow-lifted">
                    {datum.label}: {datum.value.toLocaleString()} {unit}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{unit} by channel</caption>
        <tbody>
          {sorted.map((datum) => (
            <tr key={datum.label}>
              <th scope="row">{datum.label}</th>
              <td>{datum.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(0)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}
