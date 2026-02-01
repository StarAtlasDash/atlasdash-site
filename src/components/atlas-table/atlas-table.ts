import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import template from './atlas-table.html?raw';
import style from './atlas-table.css?inline';
import '../atlas-popup';
import type { QueryRow } from '../../types/query';
import type { TableDataPlan } from '../../tables/table-spec';
import {
	createTable,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type Row,
	type SortingState,
	type TableState as TanstackTableState,
	type Updater,
	type VisibilityState,
} from '@tanstack/table-core';

type AtlasTableState = {
	columnVisibility: VisibilityState;
	columnFilters: ColumnFiltersState;
	sorting: SortingState;
	columnOrder: ColumnOrderState;
};

const DEFAULT_TABLE_STATE: TanstackTableState = {
	columnVisibility: {},
	columnOrder: [],
	columnPinning: { left: [], right: [] },
	rowPinning: { top: [], bottom: [] },
	columnFilters: [],
	globalFilter: undefined,
	sorting: [],
	expanded: {},
	grouping: [],
	columnSizing: {},
	columnSizingInfo: {
		startOffset: null,
		startSize: null,
		deltaOffset: null,
		deltaPercentage: null,
		isResizingColumn: false,
		columnSizingStart: [],
	},
	pagination: { pageIndex: 0, pageSize: 10 },
	rowSelection: {},
};

@customElement('atlas-table')
export class AtlasTable extends BaseComponentElement {
	@bindAttribute('title')
	accessor title: string = '';

	@bindAttribute('label')
	accessor label: string = '';

	@bindAttribute('description')
	accessor description: string = '';

	@bindAttribute('no-filters', { type: AttributeType.Boolean })
	accessor noFilters: boolean = false;

	@bindTemplateElement('.table-title')
	private titleEl: HTMLElement | null = null;

	@bindTemplateElement('.table-label')
	private labelEl: HTMLElement | null = null;

	@bindTemplateElement('.description-text')
	private descriptionEl: HTMLElement | null = null;

	@bindTemplateElement('.table-description')
	private descriptionWrap: HTMLElement | null = null;

	@bindTemplateElement('slot[name="description"]')
	private descriptionSlot: HTMLSlotElement | null = null;

	@bindTemplateElement('.column-toggle-list')
	private columnToggleList: HTMLDivElement | null = null;

	@bindTemplateElement('.column-toggle')
	private columnToggleWrap: HTMLDivElement | null = null;

	@bindTemplateElement('.table-head')
	private tableHeadEl: HTMLTableSectionElement | null = null;

	@bindTemplateElement('.table-body')
	private tableBodyEl: HTMLTableSectionElement | null = null;

	@bindTemplateElement('.table-scroll')
	private tableScrollEl: HTMLDivElement | null = null;

	@bindTemplateElement('.loading-overlay')
	private loadingOverlayEl: HTMLDivElement | null = null;

	private table: ReturnType<typeof createTable<QueryRow>> | null = null;
	private tablePlan: TableDataPlan | null = null;
	private tableState: TanstackTableState = { ...DEFAULT_TABLE_STATE };
	private loading = true;
	private dragColumnId: string | null = null;
	private virtualRowHeight = 0;
	private virtualStart = 0;
	private virtualEnd = 0;
	private lastVirtualStart = -1;
	private lastVirtualEnd = -1;
	private scrollHandle: number | null = null;
	private readonly virtualOverscan = 8;
	private readonly virtualRowThreshold = 150;

	constructor() {
		super(template, style);
	}

	setTableData(plan: TableDataPlan) {
		this.tablePlan = plan;
		this.initializeTable();
		this.setLoading(false);
		if (this.isConnected) {
			this.render();
		}
	}

	setLoading(loading: boolean) {
		if (this.loading === loading) {
			return;
		}
		this.loading = loading;
		if (this.isConnected) {
			this.updateLoadingState();
		}
	}

	protected render(): void {
		if (this.titleEl) {
			this.titleEl.textContent = this.title || '';
			this.titleEl.toggleAttribute('hidden', !this.title);
		}
		if (this.labelEl) {
			this.labelEl.textContent = this.label || '';
			this.labelEl.toggleAttribute('hidden', !this.label);
		}
		this.updateDescription();
		this.updateLoadingState();
		this.renderColumnTogglePanel();
		this.renderTable();
		this.updateColumnToggleVisibility();
	}

	protected onConnected(): void {
		this.updateDescription();
		this.updateLoadingState();
		this.renderColumnTogglePanel();
		this.renderTable();
		this.updateColumnToggleVisibility();
		this.tableScrollEl?.addEventListener('scroll', this.onTableScroll, { passive: true });
	}

	protected onDisconnected(): void {
		this.tableScrollEl?.removeEventListener('scroll', this.onTableScroll);
		if (this.scrollHandle !== null) {
			cancelAnimationFrame(this.scrollHandle);
			this.scrollHandle = null;
		}
	}

	protected onSlotChange = () => {
		this.updateDescription();
	};

	private initializeTable() {
		if (!this.tablePlan) {
			return;
		}
		this.tableState = {
			...DEFAULT_TABLE_STATE,
			...this.tablePlan.initialState,
		};
		this.table = createTable<QueryRow>({
			data: this.tablePlan.rows,
			columns: this.tablePlan.columns as ColumnDef<QueryRow, unknown>[],
			state: this.tableState,
			onStateChange: (updater) => {
				const next = typeof updater === 'function' ? updater(this.tableState) : updater;
				this.tableState = this.normalizeTableState(next as TanstackTableState);
				this.table?.setOptions((options) => ({
					...options,
					state: this.tableState,
				}));
				this.renderTable();
				this.renderColumnTogglePanel();
			},
			onSortingChange: (updater) => this.updateState('sorting', updater),
			onColumnFiltersChange: (updater) => this.updateState('columnFilters', updater),
			onColumnVisibilityChange: (updater) => this.updateState('columnVisibility', updater),
			onColumnOrderChange: (updater) => this.updateState('columnOrder', updater),
			enableColumnFilters: this.tablePlan.enableColumnFilters && !this.noFilters,
			renderFallbackValue: '',
			getCoreRowModel: getCoreRowModel(),
			getFilteredRowModel:
				this.tablePlan.enableColumnFilters && !this.noFilters ? getFilteredRowModel() : undefined,
			getSortedRowModel: getSortedRowModel(),
		});
	}

	private updateState<K extends keyof AtlasTableState>(key: K, updater: Updater<AtlasTableState[K]>) {
		const previous = this.tableState[key];
		const next = typeof updater === 'function' ? updater(previous) : updater;
		this.tableState = { ...this.tableState, [key]: next };
		this.table?.setOptions((options) => ({
			...options,
			state: this.tableState,
		}));
		if (key === 'columnFilters' && this.tableScrollEl) {
			this.tableScrollEl.scrollTop = 0;
		}
		this.renderTable();
		this.renderColumnTogglePanel();
	}

	private renderTable() {
		if (!this.table || !this.tableHeadEl || !this.tableBodyEl || !this.tablePlan) {
			return;
		}
		this.virtualRowHeight = 0;
		const tableHeadEl = this.tableHeadEl;
		const tableBodyEl = this.tableBodyEl;
		const tablePlan = this.tablePlan;
		const focusState = this.captureFilterFocus();
		tableHeadEl.innerHTML = '';
		tableBodyEl.innerHTML = '';
		this.lastVirtualStart = -1;
		this.lastVirtualEnd = -1;

		const headerGroups = this.table.getHeaderGroups();
		const stickyId = this.getStickyColumnId();
		const showColumnToggle = !!tablePlan.enableColumnVisibilityToggles;
		const lastHeaderRowIndex = Math.max(0, headerGroups.length - 1);

		headerGroups.forEach((group, groupIndex) => {
			const rowEl = document.createElement('tr');
			const lastHeaderIndex = this.findLastHeaderIndex(group.headers);
			group.headers.forEach((header, headerIndex) => {
				const cell = document.createElement('th');
				const column = header.column;
				const meta = column.columnDef.meta as { dataType?: string } | undefined;
				if (!header.isPlaceholder) {
					this.applyCellContent(cell, column.columnDef.header ?? column.id, header.getContext());
				}
				if (meta?.dataType === 'number') {
					cell.classList.add('is-numeric');
				}
				if (column.getCanSort()) {
					cell.classList.add('is-sortable');
					const handler = column.getToggleSortingHandler();
					if (handler) {
						cell.addEventListener('click', handler as EventListener);
						cell.addEventListener('keydown', (event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								(handler as EventListener)(event);
							}
						});
					}
					cell.setAttribute('tabindex', '0');
					const sort = column.getIsSorted();
					cell.setAttribute(
						'aria-sort',
						sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'
					);
					if (sort) {
						const indicator = document.createElement('span');
						indicator.className = 'sort-indicator';
						indicator.textContent = sort === 'desc' ? '▼' : '▲';
						cell.appendChild(indicator);
					}
				}
				if (this.tablePlan?.enableColumnReorder && !header.isPlaceholder) {
					cell.draggable = true;
					cell.addEventListener('dragstart', (event) => this.onDragStart(event, column.id));
					cell.addEventListener('dragover', (event) => this.onDragOver(event));
					cell.addEventListener('drop', (event) => this.onDrop(event, column.id));
					cell.addEventListener('dragend', () => this.onDragEnd());
				}
				if (stickyId && column.id === stickyId) {
					cell.classList.add('sticky-col');
					if (groupIndex === 0) {
						cell.classList.add('header');
					}
				}
				if (
					showColumnToggle &&
					groupIndex === lastHeaderRowIndex &&
					headerIndex === lastHeaderIndex &&
					this.columnToggleWrap
				) {
					if (this.columnToggleWrap) {
						cell.appendChild(this.columnToggleWrap);
					}
				}
				rowEl.appendChild(cell);
			});
			tableHeadEl.appendChild(rowEl);
		});

		if (tablePlan.enableColumnFilters && !this.noFilters) {
			const filterRow = document.createElement('tr');
			filterRow.className = 'filter-row';
			this.table.getVisibleLeafColumns().forEach((column) => {
				const cell = document.createElement('th');
				if (column.getCanFilter()) {
					const meta = column.columnDef.meta as { dataType?: string } | undefined;
					if (meta?.dataType === 'number') {
						cell.classList.add('is-numeric');
						const wrapper = document.createElement('div');
						wrapper.className = 'filter-range';
						const minInput = document.createElement('input');
						const maxInput = document.createElement('input');
						minInput.type = 'number';
						maxInput.type = 'number';
						minInput.className = 'filter-input-range';
						maxInput.className = 'filter-input-range';
						minInput.dataset.filterColumn = column.id;
						minInput.dataset.filterRole = 'min';
						maxInput.dataset.filterColumn = column.id;
						maxInput.dataset.filterRole = 'max';
						minInput.classList.add('is-numeric');
						maxInput.classList.add('is-numeric');
						minInput.placeholder = 'Min';
						maxInput.placeholder = 'Max';
						const current = (column.getFilterValue() as [string, string] | undefined) ?? [];
						minInput.value = current[0] ?? '';
						maxInput.value = current[1] ?? '';
						const updateRange = () => {
							const min = minInput.value.trim();
							const max = maxInput.value.trim();
							if (!min && !max) {
								column.setFilterValue(undefined);
								return;
							}
							column.setFilterValue([min, max]);
						};
						minInput.addEventListener('input', updateRange);
						maxInput.addEventListener('input', updateRange);
						wrapper.append(minInput, maxInput);
						cell.appendChild(wrapper);
					} else {
						const input = document.createElement('input');
						input.type = 'text';
						input.className = 'filter-input';
						input.dataset.filterColumn = column.id;
						input.placeholder = 'Filter...';
						input.value = String(column.getFilterValue() ?? '');
						input.addEventListener('input', (event) => {
							const target = event.target as HTMLInputElement;
							column.setFilterValue(target.value);
						});
						cell.appendChild(input);
					}
				}
				if (stickyId && column.id === stickyId) {
					cell.classList.add('sticky-col');
				}
				filterRow.appendChild(cell);
			});
			tableHeadEl.appendChild(filterRow);
		}

		const headerRows = Array.from(tableHeadEl.querySelectorAll('tr')).filter(
			(row) => !row.classList.contains('filter-row')
		);
		const headerHeight = headerRows.reduce((total, row) => total + row.getBoundingClientRect().height, 0);
		if (headerHeight > 0) {
			this.style.setProperty('--table-head-row-height', `${Math.ceil(headerHeight)}px`);
		}

		this.renderTableBody(this.table.getRowModel().rows, stickyId);

		this.restoreFilterFocus(focusState);
	}

	private renderColumnTogglePanel() {
		if (!this.tablePlan || !this.table || !this.columnToggleList) {
			return;
		}
		this.columnToggleList.innerHTML = '';
		if (!this.tablePlan.enableColumnVisibilityToggles) {
			return;
		}

		const columns = this.table.getAllLeafColumns();
		columns.forEach((column) => {
			if (!column.getCanHide()) {
				return;
			}
			const label = document.createElement('label');
			label.className = 'column-toggle-item';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = column.getIsVisible();
			checkbox.addEventListener('change', column.getToggleVisibilityHandler());
			const text = document.createElement('span');
			text.textContent = String(column.columnDef.header ?? column.id);
			label.append(checkbox, text);
			this.columnToggleList?.appendChild(label);
		});
	}

	private updateColumnToggleVisibility() {
		if (!this.columnToggleWrap) {
			return;
		}
		const showToggle = !!this.tablePlan?.enableColumnVisibilityToggles;
		this.columnToggleWrap.toggleAttribute('hidden', !showToggle);
	}

	private onTableScroll = () => {
		if (this.scrollHandle !== null) {
			cancelAnimationFrame(this.scrollHandle);
		}
		this.scrollHandle = requestAnimationFrame(() => {
			this.scrollHandle = null;
			this.renderTableBodyOnly();
		});
	};

	private renderTableBodyOnly() {
		if (!this.table || !this.tableBodyEl || !this.tablePlan) {
			return;
		}
		this.renderTableBody(this.table.getRowModel().rows, this.getStickyColumnId());
	}

	private renderTableBody(rows: Row<QueryRow>[], stickyId: string | null) {
		if (!this.tableBodyEl || !this.table) {
			return;
		}
		const tableBodyEl = this.tableBodyEl;
		const visibleColumns = this.table.getVisibleLeafColumns();
		const totalRows = rows.length;
		const shouldVirtualize = totalRows > this.virtualRowThreshold && !!this.tableScrollEl;
		if (!totalRows) {
			tableBodyEl.innerHTML = '';
			this.lastVirtualStart = -1;
			this.lastVirtualEnd = -1;
			return;
		}
		if (shouldVirtualize) {
			this.updateVirtualWindow(totalRows);
			const start = this.virtualStart;
			const end = this.virtualEnd;
			if (start === this.lastVirtualStart && end === this.lastVirtualEnd) {
				return;
			}
			this.lastVirtualStart = start;
			this.lastVirtualEnd = end;
			const slice = rows.slice(start, end);
			const padTop = this.virtualRowHeight * start;
			const padBottom = this.virtualRowHeight * Math.max(0, totalRows - end);
			tableBodyEl.innerHTML = '';
			if (padTop > 0) {
				tableBodyEl.appendChild(this.createSpacerRow(visibleColumns.length, padTop));
			}
			slice.forEach((row) => {
				const rowEl = document.createElement('tr');
				row.getVisibleCells().forEach((cell) => {
					const isRowHeader = !!(stickyId && cell.column.id === stickyId);
					const cellEl = document.createElement(isRowHeader ? 'th' : 'td');
					const meta = cell.column.columnDef.meta as { dataType?: string } | undefined;
					if (isRowHeader) {
						cellEl.setAttribute('scope', 'row');
						cellEl.classList.add('row-header');
					}
					if (meta?.dataType === 'number') {
						cellEl.classList.add('is-numeric');
					}
					const content = cell.column.columnDef.cell ?? cell.getValue();
					this.applyCellContent(cellEl, content, cell.getContext());
					if (isRowHeader) {
						cellEl.classList.add('sticky-col');
					}
					rowEl.appendChild(cellEl);
				});
				tableBodyEl.appendChild(rowEl);
			});
			if (padBottom > 0) {
				tableBodyEl.appendChild(this.createSpacerRow(visibleColumns.length, padBottom));
			}
			if (!this.virtualRowHeight || this.virtualRowHeight === 40) {
				const measured = this.estimateRowHeight();
				if (measured > 0) {
					this.virtualRowHeight = measured;
				}
			}
			return;
		}

		tableBodyEl.innerHTML = '';
		this.lastVirtualStart = -1;
		this.lastVirtualEnd = -1;
		rows.forEach((row) => {
			const rowEl = document.createElement('tr');
			row.getVisibleCells().forEach((cell) => {
				const isRowHeader = !!(stickyId && cell.column.id === stickyId);
				const cellEl = document.createElement(isRowHeader ? 'th' : 'td');
				const meta = cell.column.columnDef.meta as { dataType?: string } | undefined;
				if (isRowHeader) {
					cellEl.setAttribute('scope', 'row');
					cellEl.classList.add('row-header');
				}
				if (meta?.dataType === 'number') {
					cellEl.classList.add('is-numeric');
				}
				const content = cell.column.columnDef.cell ?? cell.getValue();
				this.applyCellContent(cellEl, content, cell.getContext());
				if (isRowHeader) {
					cellEl.classList.add('sticky-col');
				}
				rowEl.appendChild(cellEl);
			});
			tableBodyEl.appendChild(rowEl);
		});
		if (!this.virtualRowHeight || this.virtualRowHeight === 40) {
			const measured = this.estimateRowHeight();
			if (measured > 0) {
				this.virtualRowHeight = measured;
			}
		}
	}

	private updateVirtualWindow(totalRows: number) {
		if (!this.tableScrollEl) {
			this.virtualStart = 0;
			this.virtualEnd = totalRows;
			return;
		}
		if (totalRows === 0) {
			this.virtualStart = 0;
			this.virtualEnd = 0;
			return;
		}
		if (!this.virtualRowHeight) {
			this.virtualRowHeight = this.estimateRowHeight();
		}
		const rowHeight = this.virtualRowHeight || 40;
		const viewport = this.tableScrollEl.clientHeight;
		const scrollTop = this.tableScrollEl.scrollTop;
		const rowsPerView = Math.ceil(viewport / rowHeight);
		const rawStart = Math.floor(scrollTop / rowHeight) - this.virtualOverscan;
		const start = Math.max(0, Math.min(rawStart, Math.max(0, totalRows - 1)));
		const end = Math.min(totalRows, start + rowsPerView + this.virtualOverscan * 2);
		this.virtualStart = start;
		this.virtualEnd = end;
	}

	private estimateRowHeight() {
		const row = this.tableBodyEl?.querySelector('tr:not(.spacer-row)');
		if (row) {
			const rect = row.getBoundingClientRect();
			if (rect.height > 0) {
				return rect.height;
			}
		}
		return 40;
	}

	private createSpacerRow(colSpan: number, height: number) {
		const row = document.createElement('tr');
		row.className = 'spacer-row';
		const cell = document.createElement('td');
		cell.colSpan = Math.max(1, colSpan);
		cell.style.padding = '0';
		cell.style.border = 'none';
		const spacer = document.createElement('div');
		spacer.style.height = `${height}px`;
		spacer.style.width = '1px';
		cell.appendChild(spacer);
		row.appendChild(cell);
		return row;
	}

	private updateDescription() {
		if (!this.descriptionEl || !this.descriptionWrap) {
			return;
		}
		const hasSlot = (this.descriptionSlot?.assignedElements({ flatten: true }).length ?? 0) > 0;
		const hasText = !!this.description;
		this.descriptionEl.textContent = hasSlot ? '' : this.description;
		this.descriptionEl.toggleAttribute('hidden', hasSlot || !hasText);
		this.descriptionWrap.toggleAttribute('hidden', !hasSlot && !hasText);
	}

	private updateLoadingState() {
		if (this.loadingOverlayEl) {
			this.loadingOverlayEl.hidden = !this.loading;
		}
	}

	private captureFilterFocus(): {
		columnId: string;
		role?: string;
		selectionStart?: number | null;
		selectionEnd?: number | null;
	} | null {
		if (!this.tableHeadEl) {
			return null;
		}
		const active = this.contentRoot?.activeElement ?? null;
		const input = active instanceof HTMLInputElement ? active : null;
		if (!input || !this.tableHeadEl.contains(input)) {
			return null;
		}
		const columnId = input.dataset.filterColumn;
		if (!columnId) {
			return null;
		}
		return {
			columnId,
			role: input.dataset.filterRole,
			selectionStart: input.selectionStart,
			selectionEnd: input.selectionEnd,
		};
	}

	private restoreFilterFocus(
		focusState: { columnId: string; role?: string; selectionStart?: number | null; selectionEnd?: number | null } | null
	) {
		if (!focusState || !this.tableHeadEl) {
			return;
		}
		const selector = focusState.role
			? `input[data-filter-column=\"${focusState.columnId}\"][data-filter-role=\"${focusState.role}\"]`
			: `input[data-filter-column=\"${focusState.columnId}\"]`;
		const input = this.tableHeadEl.querySelector<HTMLInputElement>(selector);
		if (!input) {
			return;
		}
		input.focus();
		if (focusState.selectionStart != null && focusState.selectionEnd != null) {
			input.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
		}
	}

	private findLastHeaderIndex(headers: Array<{ isPlaceholder: boolean }>): number {
		for (let i = headers.length - 1; i >= 0; i -= 1) {
			if (!headers[i].isPlaceholder) {
				return i;
			}
		}
		return Math.max(0, headers.length - 1);
	}


	private getStickyColumnId() {
		if (!this.tablePlan?.stickyFirstColumn || !this.table) {
			return null;
		}
		const first = this.table.getVisibleLeafColumns()[0];
		return first?.id ?? null;
	}

	private normalizeTableState(state: TanstackTableState): TanstackTableState {
		return {
			...DEFAULT_TABLE_STATE,
			...state,
		};
	}

	private onDragStart(event: DragEvent, columnId: string) {
		this.dragColumnId = columnId;
		if (event.dataTransfer) {
			event.dataTransfer.setData('text/plain', columnId);
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	private onDragOver(event: DragEvent) {
		if (!this.dragColumnId) {
			return;
		}
		event.preventDefault();
	}

	private onDrop(event: DragEvent, targetId: string) {
		event.preventDefault();
		if (!this.table || !this.dragColumnId) {
			return;
		}
		const order = [...this.table.getState().columnOrder];
		const fromIndex = order.indexOf(this.dragColumnId);
		const toIndex = order.indexOf(targetId);
		if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
			return;
		}
		order.splice(fromIndex, 1);
		order.splice(toIndex, 0, this.dragColumnId);
		this.updateState('columnOrder', order);
	}

	private onDragEnd() {
		this.dragColumnId = null;
	}

	private applyCellContent(
		target: HTMLElement,
		content: unknown,
		context: unknown
	) {
		let resolved = content;
		if (typeof content === 'function') {
			try {
				resolved = content(context as never);
			} catch (error) {
				console.warn('Failed to render table cell content.', error);
				resolved = '';
			}
		}
		target.textContent = '';
		if (resolved instanceof Node) {
			target.appendChild(resolved);
		} else if (resolved != null) {
			target.textContent = String(resolved);
		}
	}
}

export function registerAtlasTable() {
	if (!customElements.get('atlas-table')) {
		customElements.define('atlas-table', AtlasTable);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-table': AtlasTable;
	}
}
