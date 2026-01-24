import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import template from './atlas-table.html?raw';
import style from './atlas-table.css?inline';
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

	@bindTemplateElement('slot[name="info"]')
	private infoSlot: HTMLSlotElement | null = null;

	@bindTemplateElement('.info-button')
	private infoButton: HTMLButtonElement | null = null;

	@bindTemplateElement('.info-popover')
	private infoPopover: HTMLDivElement | null = null;

	@bindTemplateElement('.info-close')
	private infoClose: HTMLButtonElement | null = null;

	@bindTemplateElement('.column-toggle-button')
	private columnToggleButton: HTMLButtonElement | null = null;

	@bindTemplateElement('.column-toggle-panel')
	private columnTogglePanel: HTMLDivElement | null = null;

	@bindTemplateElement('.table-head')
	private tableHeadEl: HTMLTableSectionElement | null = null;

	@bindTemplateElement('.table-body')
	private tableBodyEl: HTMLTableSectionElement | null = null;

	private table: ReturnType<typeof createTable<QueryRow>> | null = null;
	private tablePlan: TableDataPlan | null = null;
	private tableState: TanstackTableState = { ...DEFAULT_TABLE_STATE };
	private hasInfoContent = false;
	private infoOpen = false;
	private globalInfoController: AbortController | null = null;
	private columnPanelOpen = false;
	private globalColumnPanelController: AbortController | null = null;
	private dragColumnId: string | null = null;

	constructor() {
		super(template, style);
	}

	setTableData(plan: TableDataPlan) {
		this.tablePlan = plan;
		this.initializeTable();
		if (this.isConnected) {
			this.render();
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
		this.updateInfoVisibility();
		this.updateColumnToggleVisibility();
		this.renderTable();
	}

	protected onConnected(): void {
		this.bindInfoEvents();
		this.bindColumnToggleEvents();
		this.updateDescription();
		this.updateInfoVisibility();
		this.updateColumnToggleVisibility();
		this.renderTable();
	}

	protected onDisconnected(): void {
		this.unbindInfoEvents();
		this.unbindColumnToggleEvents();
	}

	protected onSlotChange = () => {
		this.updateDescription();
		this.updateInfoVisibility();
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
		this.renderTable();
		this.renderColumnTogglePanel();
	}

	private renderTable() {
		if (!this.table || !this.tableHeadEl || !this.tableBodyEl || !this.tablePlan) {
			return;
		}
		const tableHeadEl = this.tableHeadEl;
		const tableBodyEl = this.tableBodyEl;
		const tablePlan = this.tablePlan;
		tableHeadEl.innerHTML = '';
		tableBodyEl.innerHTML = '';

		const headerGroups = this.table.getHeaderGroups();
		const stickyId = this.getStickyColumnId();

		headerGroups.forEach((group, groupIndex) => {
			const rowEl = document.createElement('tr');
			group.headers.forEach((header) => {
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
					}
					const sort = column.getIsSorted();
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
						minInput.classList.add('is-numeric');
						maxInput.classList.add('is-numeric');
						minInput.placeholder = 'Min';
						maxInput.placeholder = 'Max';
						const current = (column.getFilterValue() as [string, string] | undefined) ?? [];
						minInput.value = current[0] ?? '';
						maxInput.value = current[1] ?? '';
						const updateRange = () => column.setFilterValue([minInput.value, maxInput.value]);
						minInput.addEventListener('input', updateRange);
						maxInput.addEventListener('input', updateRange);
						wrapper.append(minInput, maxInput);
						cell.appendChild(wrapper);
					} else {
						const input = document.createElement('input');
						input.type = 'text';
						input.className = 'filter-input';
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

		const rows = this.table.getRowModel().rows;
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
	}

	private renderColumnTogglePanel() {
		if (!this.tablePlan || !this.table || !this.columnTogglePanel) {
			return;
		}
		if (!this.tablePlan.enableColumnVisibilityToggles) {
			this.columnTogglePanel.innerHTML = '';
			return;
		}

		this.columnTogglePanel.innerHTML = '';
		this.table.getAllLeafColumns().forEach((column) => {
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
			this.columnTogglePanel?.appendChild(label);
		});
	}

	private updateColumnToggleVisibility() {
		if (!this.columnToggleButton) {
			return;
		}
		const showToggle = !!this.tablePlan?.enableColumnVisibilityToggles;
		this.columnToggleButton.hidden = !showToggle;
		if (!showToggle) {
			this.setColumnPanelOpen(false);
		}
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

	private updateInfoVisibility() {
		const hasInfo = (this.infoSlot?.assignedElements({ flatten: true }).length ?? 0) > 0;
		this.hasInfoContent = hasInfo;
		const showInfo = !!hasInfo;
		if (this.infoButton) {
			this.infoButton.hidden = !showInfo;
		}
		if (!showInfo) {
			this.setInfoOpen(false);
		}
	}

	private bindInfoEvents() {
		this.infoButton?.addEventListener('click', this.onInfoToggle);
		this.infoClose?.addEventListener('click', this.onInfoClose);
	}

	private unbindInfoEvents() {
		this.infoButton?.removeEventListener('click', this.onInfoToggle);
		this.infoClose?.removeEventListener('click', this.onInfoClose);
		this.detachGlobalInfoEvents();
	}

	private onInfoToggle = () => {
		this.setInfoOpen(!this.infoOpen);
	};

	private onInfoClose = () => {
		this.setInfoOpen(false);
	};

	private onDocumentKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			this.setInfoOpen(false);
			this.setColumnPanelOpen(false);
		}
	};

	private onDocumentClick = (event: MouseEvent) => {
		const path = event.composedPath();
		if (this.infoOpen && this.infoPopover && this.infoButton) {
			if (!path.includes(this.infoPopover) && !path.includes(this.infoButton)) {
				this.setInfoOpen(false);
			}
		}
		if (this.columnPanelOpen && this.columnTogglePanel && this.columnToggleButton) {
			if (!path.includes(this.columnTogglePanel) && !path.includes(this.columnToggleButton)) {
				this.setColumnPanelOpen(false);
			}
		}
	};

	private setInfoOpen(open: boolean) {
		if (open && !this.hasInfoContent) {
			return;
		}
		this.infoOpen = open;
		if (this.infoPopover) {
			this.infoPopover.hidden = !open;
		}
		if (this.infoButton) {
			this.infoButton.setAttribute('aria-expanded', String(open));
		}
		if (open) {
			this.attachGlobalInfoEvents();
		} else {
			this.detachGlobalInfoEvents();
		}
	}

	private attachGlobalInfoEvents() {
		if (this.globalInfoController) {
			return;
		}
		this.globalInfoController = new AbortController();
		const { signal } = this.globalInfoController;
		document.addEventListener('click', this.onDocumentClick, { capture: true, signal });
		document.addEventListener('keydown', this.onDocumentKeydown, { signal });
	}

	private detachGlobalInfoEvents() {
		this.globalInfoController?.abort();
		this.globalInfoController = null;
	}

	private bindColumnToggleEvents() {
		this.columnToggleButton?.addEventListener('click', this.onColumnToggle);
	}

	private unbindColumnToggleEvents() {
		this.columnToggleButton?.removeEventListener('click', this.onColumnToggle);
		this.detachColumnPanelEvents();
	}

	private onColumnToggle = () => {
		this.setColumnPanelOpen(!this.columnPanelOpen);
	};

	private setColumnPanelOpen(open: boolean) {
		if (!this.columnTogglePanel || !this.columnToggleButton) {
			return;
		}
		this.columnPanelOpen = open;
		this.columnTogglePanel.hidden = !open;
		this.columnToggleButton.setAttribute('aria-expanded', String(open));
		this.renderColumnTogglePanel();
		if (open) {
			this.attachColumnPanelEvents();
		} else {
			this.detachColumnPanelEvents();
		}
	}

	private attachColumnPanelEvents() {
		if (this.globalColumnPanelController) {
			return;
		}
		this.globalColumnPanelController = new AbortController();
		const { signal } = this.globalColumnPanelController;
		document.addEventListener('click', this.onDocumentClick, { capture: true, signal });
		document.addEventListener('keydown', this.onDocumentKeydown, { signal });
	}

	private detachColumnPanelEvents() {
		this.globalColumnPanelController?.abort();
		this.globalColumnPanelController = null;
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
