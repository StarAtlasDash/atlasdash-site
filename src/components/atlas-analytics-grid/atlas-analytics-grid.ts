import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import type { ChartSpec } from '../../charts/chart-spec';
import { applyChartRenderPlan, buildChartRenderPlan } from '../../charts/chart-spec';
import type { TableSpec } from '../../tables/table-spec';
import { applyTableRenderPlan, buildTableRenderPlan } from '../../tables/table-spec';
import { getQueryData } from '../../data/query-cache';
import template from './atlas-analytics-grid.html?raw';
import style from './atlas-analytics-grid.css?inline';

export type AnalyticsGridItemSpec = {
	id: string;
	span?: number;
	minHeight?: number;
};

export type AnalyticsGridSpec = {
	rows: AnalyticsGridItemSpec[][];
};

export type AnalyticsGridContent = {
	charts?: ChartSpec[];
	tables?: TableSpec[];
};

type NormalizedItem = {
	id: string;
	span: number;
	minHeight: number;
};

type ResolvedRow = {
	items: NormalizedItem[];
	minHeight: number;
};

@customElement('atlas-analytics-grid')
export class AtlasAnalyticsGrid extends BaseComponentElement {
	@bindAttribute('min-column-width', { type: AttributeType.Number })
	accessor minColumnWidthAttr: number = 480;

	@bindTemplateElement('.grid')
	private gridEl: HTMLDivElement | null = null;

	@bindTemplateElement('#grid-row-template')
	private rowTemplateEl: HTMLTemplateElement | null = null;

	@bindTemplateElement('#grid-item-template')
	private itemTemplateEl: HTMLTemplateElement | null = null;

	private layoutConfig: AnalyticsGridSpec | null = null;
	private layoutError: string | null = null;
	private currentColumns = 1;
	private renderHandle: number | null = null;
	private renderToken = 0;
	private contentCharts: ChartSpec[] = [];
	private contentTables: TableSpec[] = [];
	private chartSpecMap = new Map<string, ChartSpec>();
	private tableSpecMap = new Map<string, TableSpec>();
	private itemEls = new Map<string, HTMLDivElement>();
	private resolvedRows: ResolvedRow[] = [];
	private layoutVersion = 0;
	private contentVersion = 0;
	private lastLayoutSignature = '';
	private lastContentVersionApplied = -1;
	private hydratedIds = new Set<string>();

	constructor() {
		super(template, style);
	}

	setLayout(config: AnalyticsGridSpec | null) {
		if (config && !Array.isArray(config.rows)) {
			this.layoutError = 'Layout must include a rows array.';
			console.warn('Invalid layout spec passed to <atlas-analytics-grid>.');
			return;
		}
		this.layoutConfig = config;
		this.layoutError = null;
		this.layoutVersion += 1;
		this.render();
	}

	setContent(content: AnalyticsGridContent) {
		this.contentCharts = content.charts ? [...content.charts] : [];
		this.contentTables = content.tables ? [...content.tables] : [];
		this.chartSpecMap = new Map(this.contentCharts.map((spec) => [spec.id, spec]));
		this.tableSpecMap = new Map(this.contentTables.map((spec) => [spec.id, spec]));
		this.contentVersion += 1;
		this.hydratedIds.clear();
		this.render();
	}

	protected render(): void {
		if (!this.gridEl) {
			throw new Error('Grid container not found in template.');
		}

		this.updateGridMetrics();

		if (this.layoutError) {
			return;
		}

		const layout = this.layoutConfig;
		if (!layout) {
			this.clearLayout();
			return;
		}

		const layoutSignature = `${this.layoutVersion}:${this.currentColumns}`;
		const needsLayout = layoutSignature !== this.lastLayoutSignature || this.resolvedRows.length === 0;

		if (needsLayout) {
			// Resolve layout per row so the output stays deterministic.
			const normalizedRows = this.normalizeRows(layout.rows);
			this.resolvedRows = normalizedRows.flatMap((row) => this.resolveRow(row, this.currentColumns));
			this.applyResolvedRows(this.resolvedRows);
			this.lastLayoutSignature = layoutSignature;
		} else {
			this.updateItemSpans();
		}

		const needsHydration = this.contentVersion !== this.lastContentVersionApplied;
		const hydrationTargets = this.collectHydrationTargets(needsHydration);
		if (hydrationTargets.length) {
			const token = ++this.renderToken;
			this.renderContent(hydrationTargets, token, needsHydration);
			if (needsHydration) {
				this.lastContentVersionApplied = this.contentVersion;
			}
		}
	}

	protected onConnected(): void {
		window.addEventListener('resize', this.handleResize);
	}

	protected onDisconnected(): void {
		window.removeEventListener('resize', this.handleResize);
		if (this.renderHandle !== null) {
			cancelAnimationFrame(this.renderHandle);
			this.renderHandle = null;
		}
	}

	private handleResize = () => {
		this.queueLayoutUpdate();
	};

	private queueLayoutUpdate() {
		if (this.renderHandle !== null) {
			cancelAnimationFrame(this.renderHandle);
		}
		this.renderHandle = requestAnimationFrame(() => {
			this.renderHandle = null;
			const previousColumns = this.currentColumns;
			this.updateGridMetrics();
			if (this.currentColumns !== previousColumns) {
				this.render();
			}
		});
	}

	private updateGridMetrics() {
		if (!this.gridEl) {
			return;
		}
		const minColumnWidth = this.getMinColumnWidth();
		const columns = this.computeColumnCount(minColumnWidth);
		this.currentColumns = columns;
		this.gridEl.style.setProperty('--grid-columns', `${columns}`);
		this.gridEl.style.setProperty('--min-column-width', `${minColumnWidth}px`);
	}

	private clearLayout() {
		if (!this.gridEl) {
			return;
		}
		this.gridEl.innerHTML = '';
		this.itemEls.clear();
		this.resolvedRows = [];
		this.hydratedIds.clear();
		this.lastLayoutSignature = '';
	}

	private getMinColumnWidth(): number {
		const value = Number.isFinite(this.minColumnWidthAttr) ? this.minColumnWidthAttr : 480;
		return Math.max(1, Math.round(value));
	}

	private computeColumnCount(minColumnWidth: number): number {
		if (window.innerWidth <= 480) {
			return 1;
		}

		const width = Math.max(0, this.getBoundingClientRect().width);
		if (!width) {
			return 1;
		}

		const gap = this.getGridGap();
		const rawColumns = Math.floor((width + gap) / (minColumnWidth + gap));
		// Clamp to the supported 1–4 column range.
		return Math.max(1, Math.min(4, rawColumns));
	}

	private getGridGap(): number {
		if (!this.gridEl) {
			return 0;
		}
		const styles = getComputedStyle(this.gridEl);
		const gapValue = styles.columnGap || styles.gap || '0';
		const gap = parseFloat(gapValue);
		return Number.isFinite(gap) ? gap : 0;
	}

	private normalizeRows(rows: AnalyticsGridItemSpec[][] | undefined): NormalizedItem[][] {
		if (!rows || !Array.isArray(rows)) {
			return [];
		}

		const seen = new Set<string>();
		const normalizedRows: NormalizedItem[][] = [];

		rows.forEach((row, rowIndex) => {
			if (!Array.isArray(row)) {
				return;
			}

			const normalizedRow: NormalizedItem[] = [];

			row.forEach((item, itemIndex) => {
				if (!item || typeof item.id !== 'string') {
					console.warn(`Invalid layout item at row ${rowIndex}, index ${itemIndex}.`);
					return;
				}

				const id = item.id.trim();
				if (!id) {
					console.warn(`Missing layout item id at row ${rowIndex}, index ${itemIndex}.`);
					return;
				}

				if (seen.has(id)) {
					console.warn(`Duplicate layout item id "${id}" skipped.`);
					return;
				}
				seen.add(id);

				const spanValue = Number.isFinite(item.span) ? Number(item.span) : 1;
				const minHeightValue = Number.isFinite(item.minHeight) ? Number(item.minHeight) : 0;

				normalizedRow.push({
					id,
					span: Math.max(1, Math.round(spanValue)),
					minHeight: Math.max(0, Math.round(minHeightValue)),
				});
			});

			if (normalizedRow.length) {
				normalizedRows.push(normalizedRow);
			}
		});

		return normalizedRows;
	}

	private resolveRow(items: NormalizedItem[], columns: number): ResolvedRow[] {
		if (!items.length) {
			return [];
		}

		if (columns <= 1) {
			return items.map((item) => ({
				items: [{ ...item, span: 1 }],
				minHeight: item.minHeight,
			}));
		}

		const totalSpan = items.reduce((sum, item) => sum + item.span, 0);
		if (totalSpan <= columns) {
			const adjusted = this.distributeExtraSpans(items, columns);
			return [
				{
					items: adjusted,
					minHeight: this.getRowMinHeight(adjusted),
				},
			];
		}

		const maxSpan = Math.max(...items.map((item) => item.span));
		const targetIndex = items.findIndex((item) => item.span === maxSpan);
		const before = items.slice(0, targetIndex);
		const target = items[targetIndex];
		const after = items.slice(targetIndex + 1);

		const resolved: ResolvedRow[] = [];
		// Split around the widest item to keep original ordering stable.
		if (before.length) {
			resolved.push(...this.resolveRow(before, columns));
		}
		resolved.push({
			items: [{ ...target, span: columns }],
			minHeight: target.minHeight,
		});
		if (after.length) {
			resolved.push(...this.resolveRow(after, columns));
		}

		return resolved;
	}

	private distributeExtraSpans(items: NormalizedItem[], columns: number): NormalizedItem[] {
		const adjusted = items.map((item) => ({ ...item }));

		if (adjusted.length === 1) {
			adjusted[0].span = columns;
			return adjusted;
		}

		const totalSpan = adjusted.reduce((sum, item) => sum + item.span, 0);
		let extra = columns - totalSpan;
		let index = 0;

		while (extra > 0 && adjusted.length > 0) {
			adjusted[index].span += 1;
			extra -= 1;
			index = (index + 1) % adjusted.length;
		}

		return adjusted;
	}

	private getRowMinHeight(items: NormalizedItem[]): number {
		return items.reduce((max, item) => Math.max(max, item.minHeight), 0);
	}

	private applyResolvedRows(rows: ResolvedRow[]) {
		if (!this.gridEl) {
			return;
		}

		const existingRows = Array.from(this.gridEl.querySelectorAll<HTMLDivElement>('.grid-row'));
		const validIds = new Set<string>();
		const newRows: HTMLDivElement[] = [];

		rows.forEach((row) => {
			const rowEl = this.createRowElement();
			rowEl.style.minHeight = `${row.minHeight}px`;
			this.gridEl!.appendChild(rowEl);
			newRows.push(rowEl);

			row.items.forEach((item) => {
				validIds.add(item.id);
				let itemEl = this.itemEls.get(item.id);
				if (!itemEl) {
					itemEl = this.createItemElement();
					itemEl.id = item.id;
					this.itemEls.set(item.id, itemEl);
				}
				itemEl.style.minHeight = `${item.minHeight}px`;
				if (this.currentColumns > 1) {
					itemEl.style.gridColumn = `span ${item.span}`;
				} else {
					itemEl.style.removeProperty('grid-column');
				}
				rowEl.appendChild(itemEl);
			});
		});

		existingRows.forEach((rowEl) => rowEl.remove());
		for (const [id, itemEl] of this.itemEls) {
			if (!validIds.has(id)) {
				itemEl.remove();
				this.itemEls.delete(id);
				this.hydratedIds.delete(id);
			}
		}
	}

	private updateItemSpans() {
		this.resolvedRows.forEach((row) => {
			row.items.forEach((item) => {
				const itemEl = this.itemEls.get(item.id);
				if (!itemEl) {
					return;
				}
				if (this.currentColumns > 1) {
					itemEl.style.gridColumn = `span ${item.span}`;
				} else {
					itemEl.style.removeProperty('grid-column');
				}
			});
		});
	}

	private collectHydrationTargets(force: boolean): Array<{ item: NormalizedItem; container: HTMLDivElement }> {
		const targets: Array<{ item: NormalizedItem; container: HTMLDivElement }> = [];

		this.resolvedRows.forEach((row) => {
			row.items.forEach((item) => {
				const itemEl = this.itemEls.get(item.id);
				if (!itemEl) {
					return;
				}
				const hasSpec = this.chartSpecMap.has(item.id) || this.tableSpecMap.has(item.id);
				if (!hasSpec) {
					return;
				}
				const shouldHydrate = force || !this.hydratedIds.has(item.id) || itemEl.childElementCount === 0;
				if (shouldHydrate) {
					targets.push({ item, container: itemEl });
					this.hydratedIds.add(item.id);
				}
			});
		});

		return targets;
	}

	private createRowElement(): HTMLDivElement {
		if (this.rowTemplateEl) {
			const fragment = this.rowTemplateEl.content.cloneNode(true) as DocumentFragment;
			const rowEl = fragment.firstElementChild as HTMLDivElement | null;
			if (rowEl) {
				return rowEl;
			}
		}
		const rowEl = document.createElement('div');
		rowEl.className = 'grid-row';
		return rowEl;
	}

	private createItemElement(): HTMLDivElement {
		if (this.itemTemplateEl) {
			const fragment = this.itemTemplateEl.content.cloneNode(true) as DocumentFragment;
			const itemEl = fragment.firstElementChild as HTMLDivElement | null;
			if (itemEl) {
				return itemEl;
			}
		}
		const itemEl = document.createElement('div');
		itemEl.className = 'grid-item';
		return itemEl;
	}

	private renderContent(
		targets: Array<{ item: NormalizedItem; container: HTMLDivElement }>,
		token: number,
		force: boolean
	) {
		if (!targets.length) {
			return;
		}

		targets.forEach((target) => {
			void this.renderItemContent(target, token, force);
		});
	}

	private async renderItemContent(
		target: { item: NormalizedItem; container: HTMLDivElement },
		token: number,
		force: boolean
	) {
		const { item, container } = target;
		const chartSpec = this.chartSpecMap.get(item.id);
		const tableSpec = chartSpec ? undefined : this.tableSpecMap.get(item.id);

		if (!chartSpec && !tableSpec) {
			return;
		}

		if (force) {
			container.innerHTML = '';
		} else if (container.childElementCount > 0) {
			return;
		}

		if (chartSpec) {
			const chartEl = document.createElement('atlas-chart') as HTMLElement & {
				setOption?: (option: unknown) => void;
			};
			container.appendChild(chartEl);
			try {
				const data = await getQueryData(chartSpec.query);
				if (!this.isTokenActive(token, container)) {
					return;
				}
				const plan = buildChartRenderPlan(chartSpec, data);
				applyChartRenderPlan(chartEl, plan);
			} catch (error) {
				console.warn(`⚠️ Failed to render chart "${chartSpec.id}".`, error);
			}
			return;
		}

		if (tableSpec) {
			const tableEl = document.createElement('atlas-table') as HTMLElement & {
				setTableData?: (plan: unknown) => void;
			};
			container.appendChild(tableEl);
			try {
				const data = await getQueryData(tableSpec.query);
				if (!this.isTokenActive(token, container)) {
					return;
				}
				const plan = buildTableRenderPlan(tableSpec, data);
				applyTableRenderPlan(tableEl, plan);
			} catch (error) {
				console.warn(`⚠️ Failed to render table "${tableSpec.id}".`, error);
			}
		}
	}

	private isTokenActive(token: number, container: HTMLElement): boolean {
		return token === this.renderToken && !!container.isConnected;
	}
}

export function registerAtlasAnalyticsGrid() {
	if (!customElements.get('atlas-analytics-grid')) {
		customElements.define('atlas-analytics-grid', AtlasAnalyticsGrid);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-analytics-grid': AtlasAnalyticsGrid;
	}
}
