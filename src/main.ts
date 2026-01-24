import { registerAtlasChart } from './components/atlas-chart';
import { registerAtlasTable } from './components/atlas-table';
import type { ChartSpec } from './charts/chart-spec';
import { applyChartRenderPlan, buildChartRenderPlan } from './charts/chart-spec';
import type { TableSpec } from './tables/table-spec';
import { applyTableRenderPlan, buildTableRenderPlan } from './tables/table-spec';
import { getQueryData } from './data/query-cache';

registerAtlasChart();
registerAtlasTable();

document.addEventListener('DOMContentLoaded', async () => {
	const [chartResponse, tableResponse] = await Promise.all([
		fetch('/chart-specs.json'),
		fetch('/table-specs.json'),
	]);

	const chartSpecs = chartResponse.ok ? ((await chartResponse.json()) as ChartSpec[]) : [];
	const tableSpecs = tableResponse.ok ? ((await tableResponse.json()) as TableSpec[]) : [];

	if (!chartResponse.ok) {
		console.error('❌ Failed to load chart specs.');
	}
	if (!tableResponse.ok) {
		console.warn('⚠️ Failed to load table specs.');
	}

	const charts = document.querySelectorAll<HTMLElement>('atlas-chart[data-chart-id]');
	const tables = document.querySelectorAll<HTMLElement>('atlas-table[data-table-id]');
	for (const chartEl of charts) {
		const chartId = chartEl.dataset.chartId;
		if (!chartId) {
			continue;
		}

		const spec = chartSpecs.find((item) => item.id === chartId);
		if (!spec) {
			console.warn(`⚠️ No chart spec found for ${chartId}.`);
			continue;
		}

		const data = (await getQueryData(spec.query)) as Parameters<typeof buildChartRenderPlan>[1];
		const plan = buildChartRenderPlan(spec, data);
		applyChartRenderPlan(chartEl as HTMLElement & { setOption?: (opt: unknown) => void }, plan);
	}

	for (const tableEl of tables) {
		const tableId = tableEl.dataset.tableId;
		if (!tableId) {
			continue;
		}
		const spec = tableSpecs.find((item) => item.id === tableId);
		if (!spec) {
			console.warn(`⚠️ No table spec found for ${tableId}.`);
			continue;
		}
		const data = (await getQueryData(spec.query)) as Parameters<typeof buildTableRenderPlan>[1];
		const plan = buildTableRenderPlan(spec, data);
		applyTableRenderPlan(tableEl as HTMLElement & { setTableData?: (plan: unknown) => void }, plan);
	}
});
