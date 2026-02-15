import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import type { ChartSpec } from '../../charts/chart-spec';
import type { TableSpec } from '../../tables/table-spec';
import { getQueryData } from '../../data/query-cache';
import type { Filter } from '../../types/filter';
import template from './atlas-analytics-grid.html?raw';
import style from './atlas-analytics-grid.css?inline';

export type AnalyticsGridItemSpec = {
	id: string;
	span?: number;
	minHeight?: number;
	filter?: Filter[] | null;
	excludeFilters?: Filter[] | null;
};

export type FilterSelectorFilter = Filter & {
	name?: string;
	icon?: string;
};

export type FilterSelector = {
	target: string | string[];
	filters: FilterSelectorFilter[];
	label?: string;
	selected?: string | string[];
};

export type AnalyticsGridRowSpec = AnalyticsGridItemSpec[] | FilterSelector | FilterSelector[];

export type AnalyticsGridSpec = {
	rows: AnalyticsGridRowSpec[];
};

export type AnalyticsGridContent = {
	charts?: ChartSpec[];
	tables?: TableSpec[];
};

type NormalizedItem = {
	id: string;
	span: number;
	minHeight: number;
	filters: Filter[] | null;
	excludeFilters: Filter[] | null;
};

type ResolvedRow = {
	items: NormalizedItem[];
	minHeight: number;
	columns: number;
};

type LayoutBlock =
	| { type: 'items'; items: NormalizedItem[] }
	| { type: 'filters'; selectors: FilterSelector[] };

type ResolvedBlock =
	| { type: 'items'; row: ResolvedRow }
	| { type: 'filters'; selectors: FilterSelector[] };

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

	@bindTemplateElement('#grid-filter-row-template')
	private filterRowTemplateEl: HTMLTemplateElement | null = null;

	@bindTemplateElement('#grid-filter-item-template')
	private filterItemTemplateEl: HTMLTemplateElement | null = null;

	private layoutConfig: AnalyticsGridSpec | null = null;
	private layoutError: string | null = null;
	private currentColumns = 1;
	private renderHandle: number | null = null;
	private resizeDebounceHandle: number | null = null;
	private renderToken = 0;
	private contentCharts: ChartSpec[] = [];
	private contentTables: TableSpec[] = [];
	private chartSpecMap = new Map<string, ChartSpec>();
	private tableSpecMap = new Map<string, TableSpec>();
	private itemEls = new Map<string, HTMLDivElement>();
	private filterEls = new Map<string, HTMLElement>();
	private filterSelectorSignatures = new Map<string, string>();
	private resolvedBlocks: ResolvedBlock[] = [];
	private layoutVersion = 0;
	private contentVersion = 0;
	private lastLayoutSignature = '';
	private lastContentVersionApplied = -1;
	private hydratedIds = new Set<string>();
	private itemFilterSignatures = new Map<string, string>();

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
		const needsLayout = layoutSignature !== this.lastLayoutSignature || this.resolvedBlocks.length === 0;

		if (needsLayout) {
			// Resolve layout per row so the output stays deterministic.
			const normalizedBlocks = this.normalizeRows(layout.rows);
			this.resolvedBlocks = normalizedBlocks.flatMap((block): ResolvedBlock[] => {
				if (block.type === 'filters') {
					return [{ type: 'filters', selectors: block.selectors }];
				}
				return this.resolveRow(block.items, this.currentColumns).map((row) => ({ type: 'items', row }));
			});
			this.applyResolvedBlocks(this.resolvedBlocks);
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
		if (this.resizeDebounceHandle !== null) {
			window.clearTimeout(this.resizeDebounceHandle);
			this.resizeDebounceHandle = null;
		}
	}

	private handleResize = () => {
		if (this.resizeDebounceHandle !== null) {
			window.clearTimeout(this.resizeDebounceHandle);
		}
		this.resizeDebounceHandle = window.setTimeout(() => {
			this.resizeDebounceHandle = null;
			this.queueLayoutUpdate();
		}, 150);
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
		this.filterEls.clear();
		this.resolvedBlocks = [];
		this.itemFilterSignatures.clear();
		this.hydratedIds.clear();
		this.lastLayoutSignature = '';
	}

	private getMinColumnWidth(): number {
		const value = Number.isFinite(this.minColumnWidthAttr) ? this.minColumnWidthAttr : 480;
		return Math.max(1, Math.round(value));
	}

	private computeColumnCount(minColumnWidth: number): number {
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

	private normalizeRows(rows: AnalyticsGridRowSpec[] | undefined): LayoutBlock[] {
		if (!rows || !Array.isArray(rows)) {
			return [];
		}

		const seen = new Set<string>();
		const normalizedRows: LayoutBlock[] = [];

		rows.forEach((row, rowIndex) => {
			if (Array.isArray(row)) {
				if (!row.length) {
					return;
				}
				const selectors = row.filter((entry) => this.isFilterSelector(entry)) as FilterSelector[];
				const items = row.filter((entry) => this.isItemSpec(entry)) as AnalyticsGridItemSpec[];
				if (selectors.length && items.length) {
					console.warn(`Mixed filter selectors and items in row ${rowIndex}; splitting into separate rows.`);
					normalizedRows.push({ type: 'filters', selectors });
					const normalizedItems = this.normalizeItemRow(items, seen, rowIndex);
					if (normalizedItems.length) {
						normalizedRows.push({ type: 'items', items: normalizedItems });
					}
					return;
				}
				if (selectors.length) {
					normalizedRows.push({ type: 'filters', selectors });
					return;
				}
				const normalizedItems = this.normalizeItemRow(items, seen, rowIndex);
				if (normalizedItems.length) {
					normalizedRows.push({ type: 'items', items: normalizedItems });
				}
				return;
			}

			if (this.isFilterSelector(row)) {
				normalizedRows.push({ type: 'filters', selectors: [row] });
				return;
			}

			console.warn(`Invalid layout row at index ${rowIndex}.`);
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
				columns: 1,
			}));
		}

		const totalSpan = items.reduce((sum, item) => sum + item.span, 0);
		if (totalSpan <= columns) {
			const { items: adjusted, columns: rowColumns } = this.distributeExtraSpans(items, columns);
			return [
				{
					items: adjusted,
					minHeight: this.getRowMinHeight(adjusted),
					columns: rowColumns,
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
			columns,
		});
		if (after.length) {
			resolved.push(...this.resolveRow(after, columns));
		}

		return resolved;
	}

	private distributeExtraSpans(
		items: NormalizedItem[],
		columns: number
	): { items: NormalizedItem[]; columns: number } {
		const adjusted = items.map((item) => ({ ...item }));

		if (adjusted.length === 1) {
			adjusted[0].span = columns;
			return { items: adjusted, columns };
		}

		const totalSpan = adjusted.reduce((sum, item) => sum + item.span, 0);
		const extra = columns - totalSpan;
		if (extra > 0 && extra % adjusted.length === 0) {
			const add = Math.floor(extra / adjusted.length);
			adjusted.forEach((item) => {
				item.span += add;
			});
			return { items: adjusted, columns };
		}

		return { items: adjusted, columns: totalSpan };
	}

	private getRowMinHeight(items: NormalizedItem[]): number {
		return items.reduce((max, item) => Math.max(max, item.minHeight), 0);
	}

	private applyResolvedBlocks(blocks: ResolvedBlock[]) {
		if (!this.gridEl) {
			return;
		}

		const existingRows = Array.from(this.gridEl.querySelectorAll<HTMLDivElement>('.grid-row'));
		const validIds = new Set<string>();
		const validFilterKeys = new Set<string>();

		blocks.forEach((block, blockIndex) => {
			if (block.type === 'filters') {
				const rowEl = this.createFilterRowElement();
				rowEl.style.removeProperty('min-height');
				rowEl.style.setProperty('--row-columns', '1');
				this.gridEl!.appendChild(rowEl);
				block.selectors.forEach((selector, selectorIndex) => {
					const itemEl = this.createFilterItemElement();
					const key = this.getFilterSelectorKey(selector, blockIndex, selectorIndex);
					validFilterKeys.add(key);
					let filterEl = this.filterEls.get(key);
					const signature = this.getFilterSelectorSignature(selector);
					if (!filterEl) {
						filterEl = this.createFilterElement(selector);
						this.filterEls.set(key, filterEl);
						this.filterSelectorSignatures.set(key, signature);
					} else if (this.filterSelectorSignatures.get(key) !== signature) {
						this.applySelectorToFilterElement(filterEl, selector);
						this.filterSelectorSignatures.set(key, signature);
					}
					itemEl.appendChild(filterEl);
					rowEl.appendChild(itemEl);
				});
				return;
			}

			const { row } = block;
			const rowEl = this.createRowElement();
			rowEl.style.minHeight = `${row.minHeight}px`;
			rowEl.style.setProperty('--row-columns', `${Math.max(1, row.columns)}`);
			this.gridEl!.appendChild(rowEl);

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
				this.itemFilterSignatures.delete(id);
			}
		}
		for (const [key, filterEl] of this.filterEls) {
			if (!validFilterKeys.has(key)) {
				filterEl.remove();
				this.filterEls.delete(key);
				this.filterSelectorSignatures.delete(key);
			}
		}
	}

	private updateItemSpans() {
		this.resolvedBlocks.forEach((block) => {
			if (block.type !== 'items') {
				return;
			}
			block.row.items.forEach((item) => {
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

		this.resolvedBlocks.forEach((block) => {
			if (block.type !== 'items') {
				return;
			}
			block.row.items.forEach((item) => {
				const itemEl = this.itemEls.get(item.id);
				if (!itemEl) {
					return;
				}
				const hasSpec = this.chartSpecMap.has(item.id) || this.tableSpecMap.has(item.id);
				if (!hasSpec) {
					return;
				}
				const filterSignature = this.getFilterSignature(item.filters);
				const lastSignature = this.itemFilterSignatures.get(item.id) ?? '';
				const filterChanged = filterSignature !== lastSignature;
				const shouldHydrate =
					force || !this.hydratedIds.has(item.id) || itemEl.childElementCount === 0 || filterChanged;
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

	private createFilterRowElement(): HTMLDivElement {
		if (this.filterRowTemplateEl) {
			const fragment = this.filterRowTemplateEl.content.cloneNode(true) as DocumentFragment;
			const rowEl = fragment.firstElementChild as HTMLDivElement | null;
			if (rowEl) {
				return rowEl;
			}
		}
		const rowEl = document.createElement('div');
		rowEl.className = 'grid-row grid-row--filters';
		return rowEl;
	}

	private createFilterItemElement(): HTMLDivElement {
		if (this.filterItemTemplateEl) {
			const fragment = this.filterItemTemplateEl.content.cloneNode(true) as DocumentFragment;
			const itemEl = fragment.firstElementChild as HTMLDivElement | null;
			if (itemEl) {
				return itemEl;
			}
		}
		const itemEl = document.createElement('div');
		itemEl.className = 'grid-item grid-item--filter';
		return itemEl;
	}

	private createFilterElement(selector: FilterSelector): HTMLElement {
		const filterEl = document.createElement('atlas-filter');
		this.applySelectorToFilterElement(filterEl, selector);
		return filterEl;
	}

	private applySelectorToFilterElement(filterEl: HTMLElement, selector: FilterSelector) {
		const targetValue = Array.isArray(selector.target) ? selector.target.join(', ') : selector.target;
		filterEl.setAttribute('target', targetValue);
		filterEl.setAttribute('label', selector.label || 'Filter');
		if (selector.selected) {
			const selectedValue = Array.isArray(selector.selected)
				? selector.selected.join(', ')
				: selector.selected;
			filterEl.setAttribute('selected', selectedValue);
		} else {
			filterEl.removeAttribute('selected');
		}

		const field = this.getSelectorField(selector);
		if (field) {
			filterEl.setAttribute('field', field);
		} else {
			filterEl.removeAttribute('field');
		}

		filterEl.innerHTML = '';
		selector.filters.forEach((filter) => {
			const optionEl = document.createElement('div');
			const value = Array.isArray(filter.value) ? filter.value.join(',') : filter.value;
			optionEl.setAttribute('value', String(value));
			if (filter.name) {
				optionEl.setAttribute('name', filter.name);
			}
			if (filter.icon) {
				optionEl.setAttribute('icon', filter.icon);
			}
			if (filter.description) {
				optionEl.setAttribute('description', filter.description);
			}
			if (filter.info) {
				optionEl.setAttribute('info', filter.info);
			}
			if (filter.colorscheme && filter.colorscheme.length) {
				optionEl.setAttribute('colorscheme', filter.colorscheme.join(', '));
			}
			if (!field && filter.field) {
				optionEl.setAttribute('field', filter.field);
			}
			filterEl.appendChild(optionEl);
		});
	}

	private getSelectorField(selector: FilterSelector): string | null {
		const fields = selector.filters.map((filter) => filter.field).filter(Boolean);
		if (!fields.length) {
			return null;
		}
		const first = fields[0];
		if (fields.every((field) => field === first)) {
			return first;
		}
		return null;
	}

	private getFilterSignature(filters: Filter[] | null): string {
		if (!filters || !filters.length) {
			return '';
		}
		return JSON.stringify(filters);
	}

	private getFilterSelectorKey(selector: FilterSelector, rowIndex: number, selectorIndex: number): string {
		const target = Array.isArray(selector.target) ? selector.target.join('|') : selector.target;
		return `${rowIndex}:${selectorIndex}:${target}`;
	}

	private getFilterSelectorSignature(selector: FilterSelector): string {
		return JSON.stringify({
			target: selector.target,
			label: selector.label,
			selected: selector.selected,
			filters: selector.filters.map((filter) => ({
				field: filter.field,
				value: filter.value,
				name: filter.name,
				icon: filter.icon,
				description: filter.description,
				info: filter.info,
				colorscheme: filter.colorscheme,
			})),
		});
	}

	private normalizeItemRow(
		row: AnalyticsGridItemSpec[],
		seen: Set<string>,
		rowIndex: number
	): NormalizedItem[] {
		const normalizedRow: NormalizedItem[] = [];
		row.forEach((item, itemIndex) => {
			if (!this.isItemSpec(item)) {
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
			const filters = Array.isArray(item.filter) ? item.filter : null;
			const excludeFilters = Array.isArray(item.excludeFilters) ? item.excludeFilters : null;
			if (item.filter != null && !Array.isArray(item.filter)) {
				console.warn(`Filter for "${id}" should be an array of filters.`);
			}
			if (item.excludeFilters != null && !Array.isArray(item.excludeFilters)) {
				console.warn(`Exclude filters for "${id}" should be an array of filters.`);
			}
			normalizedRow.push({
				id,
				span: Math.max(1, Math.round(spanValue)),
				minHeight: Math.max(0, Math.round(minHeightValue)),
				filters,
				excludeFilters,
			});
		});
		return normalizedRow;
	}

	private isItemSpec(value: unknown): value is AnalyticsGridItemSpec {
		return !!value && typeof value === 'object' && typeof (value as AnalyticsGridItemSpec).id === 'string';
	}

	private isFilterSelector(value: unknown): value is FilterSelector {
		if (!value || typeof value !== 'object') {
			return false;
		}
		const selector = value as FilterSelector;
		if (!selector.target) {
			return false;
		}
		return Array.isArray(selector.filters);
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
			const existing = this.getRenderedDataElement(container);
			if (existing) {
				(existing as { filter?: Filter[] | null }).filter = item.filters ?? null;
				this.itemFilterSignatures.set(item.id, this.getFilterSignature(item.filters));
			}
			return;
		}

		if (chartSpec) {
			const panelEl = document.createElement('atlas-panel');
			panelEl.setAttribute('type', 'chart');
			const chartEl = document.createElement('atlas-chart') as HTMLElement & {
				setSourceData?: (spec: ChartSpec, data: unknown) => void;
				setLoading?: (loading: boolean) => void;
				filter?: Filter[] | null;
			};
			chartEl.filter = item.filters ?? null;
			chartEl.setLoading?.(true);
			panelEl.appendChild(chartEl);
			container.appendChild(panelEl);
			try {
				const data = await getQueryData(chartSpec.query);
				if (!this.isTokenActive(token, container)) {
					return;
				}
				const specOverride = item.excludeFilters
					? { ...chartSpec, excludeFilters: item.excludeFilters }
					: chartSpec;
				chartEl.setSourceData?.(specOverride, data);
				this.itemFilterSignatures.set(item.id, this.getFilterSignature(item.filters));
			} catch (error) {
				console.warn(`⚠️ Failed to render chart "${chartSpec.id}".`, error);
			}
			return;
		}

		if (tableSpec) {
			const panelEl = document.createElement('atlas-panel');
			panelEl.setAttribute('type', 'table');
			const tableEl = document.createElement('atlas-table') as HTMLElement & {
				setSourceData?: (spec: TableSpec, data: unknown) => void;
				setLoading?: (loading: boolean) => void;
				filter?: Filter[] | null;
			};
			tableEl.filter = item.filters ?? null;
			tableEl.setLoading?.(true);
			panelEl.appendChild(tableEl);
			container.appendChild(panelEl);
			try {
				const data = await getQueryData(tableSpec.query);
				if (!this.isTokenActive(token, container)) {
					return;
				}
				const specOverride = item.excludeFilters
					? { ...tableSpec, excludeFilters: item.excludeFilters }
					: tableSpec;
				tableEl.setSourceData?.(specOverride, data);
				this.itemFilterSignatures.set(item.id, this.getFilterSignature(item.filters));
			} catch (error) {
				console.warn(`⚠️ Failed to render table "${tableSpec.id}".`, error);
			}
		}
	}

	private getRenderedDataElement(container: HTMLElement): HTMLElement | null {
		const direct = container.firstElementChild as HTMLElement | null;
		if (!direct) {
			return null;
		}
		const tagName = direct.tagName.toLowerCase();
		if (tagName === 'atlas-chart' || tagName === 'atlas-table') {
			return direct;
		}
		return direct.querySelector<HTMLElement>('atlas-chart, atlas-table');
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
