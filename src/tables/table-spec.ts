import {
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type SortingState,
	type VisibilityState,
} from '@tanstack/table-core';
import type { QueryResponseData } from '../types/queried_data';
import type { QueryRow, R2QueryRef } from '../types/query';
import { renderMarkdown } from '../utils/markdown';

export interface TableColumnSpec {
	field: string;
	label?: string;
	hidden?: boolean;
	filter?: boolean;
	sortable?: boolean;
}

export interface TableSpec {
	id: string;
	title: string;
	label?: string;
	description?: string;
	descriptionMd?: string;
	infoMd?: string;
	query: R2QueryRef;
	columns?: TableColumnSpec[];
	excludeColumns?: string[];
	enableColumnFilters?: boolean;
	enableColumnVisibilityToggles?: boolean;
	enableColumnReorder?: boolean;
	stickyFirstColumn?: boolean;
	defaultSort?: { field: string; desc?: boolean }[];
}

export interface TableDataPlan {
	columns: ColumnDef<QueryRow, unknown>[];
	rows: QueryRow[];
	enableColumnFilters: boolean;
	enableColumnVisibilityToggles: boolean;
	enableColumnReorder: boolean;
	stickyFirstColumn: boolean;
	initialState: {
		columnVisibility: VisibilityState;
		columnFilters: ColumnFiltersState;
		sorting: SortingState;
		columnOrder: ColumnOrderState;
	};
}

export interface TableRenderPlan {
	attrs: {
		title: string;
		label?: string;
		description?: string;
	};
	descriptionHtml?: string;
	infoHtml?: string;
	table: TableDataPlan;
}

interface TableColumnMeta {
	dataType: 'number' | 'text';
}

export function buildTableRenderPlan(spec: TableSpec, data: QueryResponseData): TableRenderPlan {
	const descriptionContent = spec.descriptionMd ?? spec.description;
	const infoContent = spec.infoMd;
	const descriptionHtml = descriptionContent ? renderMarkdown(descriptionContent) : undefined;
	const infoHtml = infoContent ? renderMarkdown(infoContent) : undefined;

	const attrs: TableRenderPlan['attrs'] = {
		title: spec.title,
		label: spec.label,
	};
	if (spec.description && !descriptionHtml) {
		attrs.description = spec.description;
	}

	const table = buildTableDataPlan(spec, data);

	return {
		attrs,
		descriptionHtml,
		infoHtml,
		table,
	};
}

export function applyTableRenderPlan(
	element: HTMLElement & { setTableData?: (plan: TableDataPlan) => void },
	plan: TableRenderPlan
) {
	element.setAttribute('title', plan.attrs.title);
	if (plan.attrs.label) {
		element.setAttribute('label', plan.attrs.label);
	} else {
		element.removeAttribute('label');
	}
	if (plan.attrs.description) {
		element.setAttribute('description', plan.attrs.description);
	} else {
		element.removeAttribute('description');
	}

	upsertSlot(element, 'description', plan.descriptionHtml);
	if (typeof (element as HTMLElement & { setInfoContent?: (html: string | null) => void }).setInfoContent === 'function') {
		(element as HTMLElement & { setInfoContent?: (html: string | null) => void }).setInfoContent?.(plan.infoHtml ?? null);
	} else {
		upsertSlot(element, 'info', plan.infoHtml);
	}

	if (typeof element.setTableData !== 'function') {
		throw new Error('Expected <atlas-table> element with setTableData().');
	}
	element.setTableData(plan.table);
}

function buildTableDataPlan(spec: TableSpec, data: QueryResponseData): TableDataPlan {
	const columnTypes = new Map(data.columns.map((col) => [col.name, col.type]));
	const columnNames = new Set(columnTypes.keys());
	const columnSpecMap = new Map((spec.columns ?? []).map((col) => [col.field, col]));
	const excluded = new Set(spec.excludeColumns ?? []);

	const enableColumnFilters = spec.enableColumnFilters !== false;
	const enableColumnVisibilityToggles = spec.enableColumnVisibilityToggles !== false;
	const enableColumnReorder = spec.enableColumnReorder === true;
	const stickyFirstColumn = spec.stickyFirstColumn !== false;

	const columnVisibility: VisibilityState = {};
const columns: ColumnDef<QueryRow, unknown>[] = [];

	(spec.columns ?? []).forEach((col) => {
		if (!columnNames.has(col.field)) {
			console.warn(`[table-spec:${spec.id}] Missing column "${col.field}" referenced in columns[].`);
		}
	});
	(spec.excludeColumns ?? []).forEach((field) => {
		if (!columnNames.has(field)) {
			console.warn(`[table-spec:${spec.id}] Missing column "${field}" referenced in excludeColumns[].`);
		}
	});

	data.columns.forEach((col) => {
		if (excluded.has(col.name)) {
			return;
		}
		const columnSpec = columnSpecMap.get(col.name);
		const label = columnSpec?.label ?? col.name;
		const dataType = isNumberType(col.type) ? 'number' : 'text';
		const enableColumnFilter = columnSpec?.filter ?? enableColumnFilters;
		const enableSorting = columnSpec?.sortable ?? true;
		const hidden = columnSpec?.hidden ?? false;

		columnVisibility[col.name] = !hidden;
		columns.push({
			accessorKey: col.name,
			header: label,
			enableHiding: enableColumnVisibilityToggles,
			enableSorting,
			enableColumnFilter,
			filterFn: dataType === 'number' ? numberRangeFilter : textFilter,
			meta: { dataType } satisfies TableColumnMeta,
			cell: (info) => formatCell(info.getValue(), dataType),
		});
	});

	const columnOrder = columns
		.map((col) => {
			if ('accessorKey' in col && col.accessorKey != null) {
				return String(col.accessorKey);
			}
			return col.id ?? '';
		})
		.filter((id) => !!id);
	const sorting = buildDefaultSort(spec, columnNames);

	return {
		columns,
		rows: data.rows,
		enableColumnFilters,
		enableColumnVisibilityToggles,
		enableColumnReorder,
		stickyFirstColumn,
		initialState: {
			columnVisibility,
			columnFilters: [],
			sorting,
			columnOrder,
		},
	};
}

function buildDefaultSort(spec: TableSpec, columns: Set<string>): SortingState {
	if (!spec.defaultSort || !spec.defaultSort.length) {
		return [];
	}
	return spec.defaultSort
		.map((entry) => {
			if (!columns.has(entry.field)) {
				console.warn(`[table-spec:${spec.id}] Missing column "${entry.field}" in defaultSort.`);
				return null;
			}
			return { id: entry.field, desc: !!entry.desc };
		})
		.filter((entry): entry is NonNullable<typeof entry> => !!entry);
}

function isNumberType(type: string | undefined) {
	if (!type) {
		return false;
	}
	const normalized = type.toLowerCase();
	return ['number', 'fixed', 'float', 'integer', 'real', 'int', 'decimal', 'numeric', 'double'].includes(normalized);
}

function formatCell(value: unknown, dataType: TableColumnMeta['dataType']) {
	if (value == null) {
		return '';
	}
	if (dataType === 'number') {
		const numeric = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(numeric)) {
			return numeric.toLocaleString();
		}
	}
	return String(value);
}

function textFilter(row: { getValue: (id: string) => unknown }, columnId: string, value: unknown) {
	const filterValue = String(value ?? '').trim().toLowerCase();
	if (!filterValue) {
		return true;
	}
	const rowValue = row.getValue(columnId);
	return String(rowValue ?? '').toLowerCase().includes(filterValue);
}

function numberRangeFilter(
	row: { getValue: (id: string) => unknown },
	columnId: string,
	value: unknown
) {
	if (!Array.isArray(value)) {
		return true;
	}
	const [min, max] = value;
	const numeric = Number(row.getValue(columnId));
	if (!Number.isFinite(numeric)) {
		return false;
	}
	if (min != null && min !== '' && Number.isFinite(Number(min)) && numeric < Number(min)) {
		return false;
	}
	if (max != null && max !== '' && Number.isFinite(Number(max)) && numeric > Number(max)) {
		return false;
	}
	return true;
}

function upsertSlot(element: HTMLElement, slotName: string, html?: string) {
	const existing = element.querySelector(`[slot="${slotName}"]`) as HTMLElement | null;
	if (!html) {
		existing?.remove();
		return;
	}
	const slotEl = existing ?? document.createElement('div');
	slotEl.setAttribute('slot', slotName);
	slotEl.innerHTML = html;
	if (!existing) {
		element.appendChild(slotEl);
	}
}
