import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bar, Line, Pie } from '@ant-design/charts';
import { Typography } from '@douyinfe/semi-ui';
import { formatCompactTokenValue } from './chart-format';

const { Text } = Typography;

const DEFAULT_CHART_HEIGHT = 220;
const COMPACT_CHART_HEIGHT = 180;

export interface DashboardValueDatum {
  label: string;
  value: number;
  category?: string;
}

export interface DashboardActivityDatum {
  date: string;
  category: string;
  value: number;
}

interface DashboardChartProps<T> {
  data: T[];
  emptyText?: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function isEmpty(data: Array<{ value: number }>): boolean {
  return data.length === 0 || data.every((item) => item.value <= 0);
}

function useResponsiveChartHeight(minHeight = DEFAULT_CHART_HEIGHT) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(minHeight);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const updateHeight = (height: number) => {
      setChartHeight(Math.max(minHeight, Math.round(height)));
    };

    updateHeight(node.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      updateHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [minHeight]);

  return { containerRef, chartHeight };
}

function EmptyChart({ text }: { text?: string }) {
  return (
    <div className="dashboard-antv-chart dashboard-chart-empty">
      <Text type="tertiary" size="small">{text}</Text>
    </div>
  );
}

export function ModelUsageBarChart({ data, emptyText }: DashboardChartProps<DashboardValueDatum>) {
  const { containerRef, chartHeight } = useResponsiveChartHeight();
  const config = useMemo(() => ({
    data,
    xField: 'value',
    yField: 'label',
    height: chartHeight,
    autoFit: true,
    padding: [8, 18, 28, 118],
    colorField: 'label',
    legend: false,
    axis: {
      x: {
        title: false,
        labelFontSize: 11,
        labelFill: cssVar('--semi-color-text-1', '#4e5969'),
        gridStroke: cssVar('--semi-color-border', '#e5e6eb'),
        gridLineDash: [3, 3],
        labelFormatter: (value: string) => formatCompactTokenValue(Number(value)),
      },
      y: {
        title: false,
        labelFontSize: 11,
        labelFill: cssVar('--semi-color-text-0', '#1d2129'),
      },
    },
    scale: {
      color: {
        range: [
          cssVar('--semi-color-primary', '#0066ff'),
          cssVar('--semi-color-success', '#00a870'),
          cssVar('--semi-color-warning', '#ff7d00'),
        ],
      },
    },
    style: {
      radiusTopRight: 6,
      radiusBottomRight: 6,
      maxWidth: 22,
    },
    tooltip: {
      items: [{
        field: 'value',
        name: 'Tokens',
        valueFormatter: (value: number) => formatCompactTokenValue(value),
      }],
    },
  }), [chartHeight, data]);

  if (isEmpty(data)) return <EmptyChart text={emptyText} />;

  return (
    <div ref={containerRef} className="dashboard-antv-chart">
      <Bar {...config} />
    </div>
  );
}

export function TokenCompositionChart({ data, emptyText }: DashboardChartProps<DashboardValueDatum>) {
  const { containerRef, chartHeight } = useResponsiveChartHeight(COMPACT_CHART_HEIGHT);
  const config = useMemo(() => ({
    data,
    angleField: 'value',
    colorField: 'label',
    height: chartHeight,
    autoFit: true,
    innerRadius: 0.62,
    padding: [8, 8, 8, 8],
    scale: {
      color: {
        range: [
          cssVar('--semi-color-primary', '#0066ff'),
          cssVar('--semi-color-success', '#00a870'),
          cssVar('--semi-color-warning', '#ff7d00'),
          cssVar('--semi-color-danger', '#f53f3f'),
        ],
      },
    },
    legend: {
      color: {
        position: 'bottom',
        layout: { justifyContent: 'center' },
      },
    },
    tooltip: {
      items: [{
        field: 'value',
        name: 'Tokens',
        valueFormatter: (value: number) => formatCompactTokenValue(value),
      }],
    },
  }), [chartHeight, data]);

  if (isEmpty(data)) return <EmptyChart text={emptyText} />;

  return (
    <div ref={containerRef} className="dashboard-antv-chart dashboard-antv-chart-compact">
      <Pie {...config} />
    </div>
  );
}

export function ProviderQuotaBarChart({ data, emptyText }: DashboardChartProps<DashboardValueDatum>) {
  const { containerRef, chartHeight } = useResponsiveChartHeight(COMPACT_CHART_HEIGHT);
  const config = useMemo(() => ({
    data,
    xField: 'value',
    yField: 'label',
    height: chartHeight,
    autoFit: true,
    padding: [8, 18, 26, 92],
    colorField: 'category',
    legend: false,
    scale: {
      x: { domain: [0, 100] },
      color: {
        range: [
          cssVar('--semi-color-success', '#00a870'),
          cssVar('--semi-color-warning', '#ff7d00'),
          cssVar('--semi-color-danger', '#f53f3f'),
        ],
      },
    },
    axis: {
      x: {
        title: false,
        labelFontSize: 11,
        labelFill: cssVar('--semi-color-text-1', '#4e5969'),
        labelFormatter: (value: string) => `${Math.round(Number(value))}%`,
      },
      y: {
        title: false,
        labelFontSize: 11,
        labelFill: cssVar('--semi-color-text-0', '#1d2129'),
      },
    },
    style: {
      radiusTopRight: 6,
      radiusBottomRight: 6,
      maxWidth: 18,
    },
    tooltip: {
      items: [{
        field: 'value',
        name: 'Left',
        valueFormatter: (value: number) => `${Math.round(value)}%`,
      }],
    },
  }), [chartHeight, data]);

  if (isEmpty(data)) return <EmptyChart text={emptyText} />;

  return (
    <div ref={containerRef} className="dashboard-antv-chart dashboard-antv-chart-compact">
      <Bar {...config} />
    </div>
  );
}

export function ActivityTrendChart({ data, emptyText }: DashboardChartProps<DashboardActivityDatum>) {
  const { containerRef, chartHeight } = useResponsiveChartHeight();
  const config = useMemo(() => ({
    data,
    xField: 'date',
    yField: 'value',
    colorField: 'category',
    height: chartHeight,
    autoFit: true,
    padding: [16, 18, 32, 36],
    shapeField: 'smooth',
    scale: {
      color: {
        range: [
          cssVar('--semi-color-primary', '#0066ff'),
          cssVar('--semi-color-success', '#00a870'),
          cssVar('--semi-color-warning', '#ff7d00'),
          cssVar('--semi-color-danger', '#f53f3f'),
        ],
      },
    },
    axis: {
      x: {
        title: false,
        labelFontSize: 11,
        labelFill: cssVar('--semi-color-text-1', '#4e5969'),
        lineStroke: cssVar('--semi-color-border', '#e5e6eb'),
      },
      y: {
        title: false,
        labelFontSize: 11,
        labelFill: cssVar('--semi-color-text-1', '#4e5969'),
        gridStroke: cssVar('--semi-color-border', '#e5e6eb'),
        gridLineDash: [3, 3],
      },
    },
    legend: {
      color: { position: 'bottom' },
    },
    tooltip: {
      items: [{ field: 'value', name: 'Count' }],
    },
  }), [chartHeight, data]);

  if (isEmpty(data)) return <EmptyChart text={emptyText} />;

  return (
    <div ref={containerRef} className="dashboard-antv-chart">
      <Line {...config} />
    </div>
  );
}

export function StatusDistributionChart({ data, emptyText }: DashboardChartProps<DashboardValueDatum>) {
  const { containerRef, chartHeight } = useResponsiveChartHeight(COMPACT_CHART_HEIGHT);
  const config = useMemo(() => ({
    data,
    angleField: 'value',
    colorField: 'label',
    height: chartHeight,
    autoFit: true,
    innerRadius: 0.58,
    padding: [8, 8, 8, 8],
    scale: {
      color: {
        range: [
          cssVar('--semi-color-success', '#00a870'),
          cssVar('--semi-color-danger', '#f53f3f'),
          cssVar('--semi-color-warning', '#ff7d00'),
          cssVar('--semi-color-primary', '#0066ff'),
          cssVar('--semi-color-text-2', '#86909c'),
        ],
      },
    },
    legend: {
      color: { position: 'bottom' },
    },
    tooltip: {
      items: [{ field: 'value', name: 'Runs' }],
    },
  }), [chartHeight, data]);

  if (isEmpty(data)) return <EmptyChart text={emptyText} />;

  return (
    <div ref={containerRef} className="dashboard-antv-chart dashboard-antv-chart-compact">
      <Pie {...config} />
    </div>
  );
}
