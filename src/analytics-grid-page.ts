import { registerAtlasAnalyticsGrid } from './components/atlas-analytics-grid';
import { registerAtlasChart } from './components/atlas-chart';
import { registerAtlasTable } from './components/atlas-table';
import type { AnalyticsGridSpec } from './components/atlas-analytics-grid/atlas-analytics-grid';
import type { ChartSpec } from './charts/chart-spec';
import type { TableSpec } from './tables/table-spec';

registerAtlasAnalyticsGrid();
registerAtlasChart();
registerAtlasTable();

document.addEventListener('DOMContentLoaded', async () => {
	const gridEl = document.querySelector<HTMLElement & {
		setLayout?: (spec: AnalyticsGridSpec | null) => void;
		setContent?: (content: { charts?: ChartSpec[]; tables?: TableSpec[] }) => void;
	}>('atlas-analytics-grid');

	if (!gridEl) {
		return;
	}

	const gridSpecPath = resolveGridSpecPath();
	if (!gridSpecPath) {
		console.warn('⚠️ No grid spec mapping found for this page.');
		return;
	}

	const [gridResponse, chartResponse, tableResponse] = await Promise.all([
		fetch(gridSpecPath),
		fetch('/chart-specs.json'),
		fetch('/table-specs.json'),
	]);

	const gridSpec = gridResponse.ok
		? ((await gridResponse.json()) as AnalyticsGridSpec)
		: null;
	const chartSpecs = chartResponse.ok ? ((await chartResponse.json()) as ChartSpec[]) : [];
	const tableSpecs = tableResponse.ok ? ((await tableResponse.json()) as TableSpec[]) : [];

	if (!gridResponse.ok) {
		console.warn(`⚠️ Failed to load grid spec from ${gridSpecPath}.`);
	}
	if (!chartResponse.ok) {
		console.warn('⚠️ Failed to load chart specs.');
	}
	if (!tableResponse.ok) {
		console.warn('⚠️ Failed to load table specs.');
	}

	gridEl.setLayout?.(gridSpec);
	gridEl.setContent?.({ charts: chartSpecs, tables: tableSpecs });
});

function resolveGridSpecPath(): string | null {
	const page = window.location.pathname.split('/').pop() || '';

	if (page === 'ecosystem.html') {
		return '/grid-specs/ecosystem.json';
	}
	if (page === 'economy.html') {
		return '/grid-specs/economy.json';
	}
	if (page === 'tokenomics.html') {
		return '/grid-specs/tokenomics.json';
	}

	return null;
}
