import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Column } from '@ant-design/charts';
import type { GatewayUsageTrendPoint } from '../../lib/gateway-usage';
import { formatCompactTokenValue } from './chart-format';

interface UsageTrendChartProps {
  trend: GatewayUsageTrendPoint[];
}

const MIN_CHART_HEIGHT = 220;

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export default function UsageTrendChart({ trend }: UsageTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(MIN_CHART_HEIGHT);
  const data = useMemo(
    () =>
      trend.map((point) => ({
        date: point.date.slice(5),
        tokens: point.totalTokens,
        cost: point.estimatedCostUsd,
      })),
    [trend],
  );

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const updateHeight = (height: number) => {
      setChartHeight(Math.max(MIN_CHART_HEIGHT, Math.round(height)));
    };

    updateHeight(node.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      updateHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const config = useMemo(
    () => ({
      data,
      xField: 'date',
      yField: 'tokens',
      height: chartHeight,
      autoFit: true,
      padding: [16, 12, 32, 42],
      colorField: 'date',
      scale: {
        color: {
          range: [cssVar('--semi-color-primary', '#0066ff'), cssVar('--semi-color-success', '#00a870')],
        },
      },
      legend: false,
      axis: {
        x: {
          title: false,
          labelFontSize: 11,
          labelFill: cssVar('--semi-color-text-1', '#4e5969'),
          lineStroke: cssVar('--semi-color-border', '#e5e6eb'),
          tick: false,
        },
        y: {
          title: false,
          labelFontSize: 11,
          labelFill: cssVar('--semi-color-text-1', '#4e5969'),
          gridStroke: cssVar('--semi-color-border', '#e5e6eb'),
          gridLineDash: [3, 3],
          labelFormatter: (value: string) => formatCompactTokenValue(Number(value)),
        },
      },
      style: {
        radiusTopLeft: 6,
        radiusTopRight: 6,
        radiusBottomLeft: 2,
        radiusBottomRight: 2,
        maxWidth: 34,
      },
      tooltip: {
        title: (item: { date?: string }) => item.date ?? '',
        items: [
          {
            field: 'tokens',
            name: 'Tokens',
            valueFormatter: (value: number) => formatNumber(value),
          },
          {
            field: 'cost',
            name: 'Cost',
            valueFormatter: (value?: number) => (value === undefined ? '-' : `$${value.toFixed(4)}`),
          },
        ],
      },
    }),
    [chartHeight, data],
  );

  return (
    <div ref={containerRef} className="dashboard-antv-chart">
      <Column {...config} />
    </div>
  );
}
