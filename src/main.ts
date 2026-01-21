import { registerAtlasChart } from './components/atlas-chart';
import type { ChartSpec } from './charts/chart-spec';
import { applyChartRenderPlan, buildChartRenderPlan } from './charts/chart-spec';
import { fetchQueryData } from './getdata';

registerAtlasChart();

document.addEventListener('DOMContentLoaded', async () => {
	const specResponse = await fetch('/chart-specs.json');
	if (!specResponse.ok) {
		console.error('❌ Failed to load chart specs.');
		return;
	}

	const specs = (await specResponse.json()) as ChartSpec[];
	const charts = document.querySelectorAll<HTMLElement>('atlas-chart[data-chart-id]');
	const dataCache = new Map<string, Promise<unknown>>();

	for (const chartEl of charts) {
		const chartId = chartEl.dataset.chartId;
		if (!chartId) {
			continue;
		}

		const spec = specs.find((item) => item.id === chartId);
		if (!spec) {
			console.warn(`⚠️ No chart spec found for ${chartId}.`);
			continue;
		}

		const queryKey = `${spec.query.source}/${spec.query.dataset}`;
		if (!dataCache.has(queryKey)) {
			dataCache.set(queryKey, fetchQueryData(spec.query));
		}
		const data = (await dataCache.get(queryKey)) as Parameters<typeof buildChartRenderPlan>[1];
		const plan = buildChartRenderPlan(spec, data);
		applyChartRenderPlan(chartEl as HTMLElement & { setOption?: (opt: unknown) => void }, plan);
	}
});
