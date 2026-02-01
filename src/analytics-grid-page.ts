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
		dataset?: { gridSpec?: string };
	}>('atlas-analytics-grid');

	if (!gridEl) {
		return;
	}

	const gridSpecPath = gridEl.dataset?.gridSpec;
	if (!gridSpecPath) {
		console.warn('⚠️ No grid spec defined on the grid element.');
		return;
	}

	const fetchJson = async <T>(url: string, label: string): Promise<T | null> => {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.warn(`⚠️ Failed to load ${label} from ${url}.`);
				return null;
			}
			return (await response.json()) as T;
		} catch (error) {
			console.warn(`⚠️ Failed to parse ${label} from ${url}.`, error);
			return null;
		}
	};

	const [gridSpec, chartSpecs, tableSpecs] = await Promise.all([
		fetchJson<AnalyticsGridSpec>(gridSpecPath, 'grid spec'),
		fetchJson<ChartSpec[]>('/chart-specs.json', 'chart specs'),
		fetchJson<TableSpec[]>('/table-specs.json', 'table specs'),
	]);

	gridEl.setLayout?.(gridSpec);
	gridEl.setContent?.({ charts: chartSpecs ?? [], tables: tableSpecs ?? [] });
});
