import * as echarts from 'echarts';
import { fetchDAUData } from './getdata';
import type { DailyActiveUser } from './types/queried_data';

/**
 * Renders the Daily Active Users (SAGE) chart using ECharts v6.
 */
async function renderDAUChart_OLD(): Promise<void> {
	// Fetch the processed DAU data
	const data: DailyActiveUser[] = await fetchDAUData();

	// Resolve theme colors from CSS variables
	const rootStyles: CSSStyleDeclaration = getComputedStyle(document.documentElement);
	const accent: string = rootStyles.getPropertyValue('--accent').trim();
	const accentLight: string = rootStyles.getPropertyValue('--accent-light').trim();

	// Initialize ECharts instance
	const chartDom: HTMLElement | null = document.getElementById('dailyUsersChart');
	if (!chartDom) {
		console.error('❌ Chart container #dailyUsersChart not found.');
		return;
	}

	const chart: echarts.ECharts = echarts.init(chartDom, undefined, { renderer: 'canvas' });

	// Configure and render chart
	chart.setOption<echarts.EChartsOption>({
		backgroundColor: 'transparent',
		tooltip: {
			trigger: 'axis',
			backgroundColor: '#fff',
			borderColor: accent,
			borderWidth: 1,
			textStyle: { color: '#111' },
			formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => {
				const p = Array.isArray(params) ? params[0] : params;
				const date = p.axisValueLabel as string;
				const dau = (p.value as [string, number])[1];
				return `<strong>${date}</strong><br/>${dau} active users`;
			},
		},
		grid: { left: 50, right: 20, top: 30, bottom: 40 },
		xAxis: {
			type: 'category',
			data: data.map((d) => d.date.toISOString().split('T')[0]),
			axisLine: { lineStyle: { color: '#bbb' } },
			axisLabel: {
				color: '#444',
				formatter: (val: string) => val.slice(5), // show MM-DD
				interval: (index: number) => index % 7 === 0, // weekly ticks
			},
		},
		yAxis: {
			type: 'value',
			axisLine: { lineStyle: { color: '#bbb' } },
			splitLine: { lineStyle: { color: '#eee' } },
			axisLabel: { color: '#444' },
		},
		series: [
			{
				type: 'bar',
				data: data.map((d) => [d.date.toISOString().split('T')[0], d.dau]),
				itemStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: accentLight },
						{ offset: 1, color: accent },
					]),
				},
			},
		],
	});

	window.addEventListener('resize', () => chart.resize());
}

/**
 * Renders the Daily Active Users chart for SAGE over 180 days.
 */
export async function renderDAUChart(targetEl: HTMLElement): Promise<void> {
	const data: DailyActiveUser[] = await fetchDAUData();

	// Resolve accent colors from CSS variables
	const rootStyles: CSSStyleDeclaration = getComputedStyle(document.documentElement);
	const accent: string = rootStyles.getPropertyValue('--accent').trim(); // e.g. #7c3aed
	const accentLight: string = rootStyles.getPropertyValue('--accent-light').trim(); // e.g. #a78bfa

	if (!targetEl) {
		console.error('❌ Chart container not found.');
		return;
	}

	const chart: echarts.ECharts = echarts.init(targetEl, undefined, { renderer: 'canvas' });

	const xData: string[] = data.map((d) => d.date.toISOString().split('T')[0]);
	const yData: number[] = data.map((d) => d.dau);

	const option: echarts.EChartsOption = {
		backgroundColor: 'transparent',
		tooltip: {
			trigger: 'axis',
			backgroundColor: '#fff',
			borderColor: accent,
			borderWidth: 1,
			textStyle: { color: '#111' },
			formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => {
				const p = Array.isArray(params) ? params[0] : params;
				const date = p.axisValueLabel as string;
				const dau = (p.value as [string, number])[1];
				return `<strong>${date}</strong><br/>${dau.toLocaleString()} active users`;
			},
		},
		grid: { left: 50, right: 20, top: 30, bottom: 40 },
		xAxis: {
			type: 'category',
			data: xData,
			axisLine: { lineStyle: { color: '#bbb' } },
			axisLabel: {
				color: '#444',
				formatter: (val: string) => val.slice(5), // show MM-DD
				interval: (index: number) => index % 7 === 0, // weekly labels
			},
		},
		yAxis: {
			type: 'value',
			axisLine: { lineStyle: { color: '#bbb' } },
			splitLine: { lineStyle: { color: '#eee' } },
			axisLabel: { color: '#444' },
		},
		series: [
			{
				type: 'bar',
				data: data.map((d) => [d.date.toISOString().split('T')[0], d.dau]),
				itemStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: accentLight },
						{ offset: 1, color: accent },
					]),
				},
			},
		],
	};

	chart.setOption(option);
	window.addEventListener('resize', () => chart.resize());
}
