import { useMemo } from 'react';
import { Column } from '@ant-design/charts';
import type { GatewayUsageTrendPoint } from '../../lib/gateway-usage';
import { formatCompactTokenValue } from './chart-format';

interface UsageTrendChartProps {
  trend: GatewayUsageTrendPoint[];
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export default function UsageTrendChart({ trend }: UsageTrendChartProps) {
  const data = useMemo(
    () => trend.map((point) => ({
      date: point.date.slice(5),
      tokens: point.totalTokens,
      cost: point.estimatedCostUsd,
    })),
    [trend],
  );

  const config = useMemo(() => ({
    data,
    xField: 'date',
    yField: 'tokens',
    height: 132,
    autoFit: true,
    padding: [8, 8, 24, 34],
    colorField: 'date',
    scale: {
      color: {
        range: [
          cssVar('--semi-color-primary', '#0066ff'),
          cssVar('--semi-color-success', '#00a870'),
        ],
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
  }), [data]);

  return (
    <div className="dashboard-antv-chart">
      <Column {...config} />
    </div>
  );
}
