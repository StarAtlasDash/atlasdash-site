import type * as echarts from 'echarts';
import type { QueryResponseData } from '../types/queried_data';
import type { QueryRow, QueryValue, R2QueryRef } from '../types/query';

export type ChartType = 'bar' | 'line' | 'area' | 'stacked-bar';

export interface ChartAxisSpec {
	field: string;
	type?: 'category' | 'time';
	label?: string;
	labelDensity?: number;
}

export interface ChartSeriesSpec {
	name: string;
	field?: string;
	derive?: {
		op: 'add' | 'subtract' | 'multiply' | 'divide';
		fields: [string, string];
	};
	type?: 'bar' | 'line' | 'area';
	stack?: string;
	yAxisIndex?: number;
}

export interface ChartSeriesFromField {
	nameField: string;
	valueField: string;
	type?: 'bar' | 'line' | 'area';
	stack?: string;
	yAxisIndex?: number;
}

export interface ChartSeriesFromColumnsField {
	field: string;
	name?: string;
	type?: 'bar' | 'line' | 'area';
	stack?: string;
	yAxisIndex?: number;
}

export interface ChartSeriesFromColumns {
	fields: ChartSeriesFromColumnsField[];
}

export interface ChartSortSpec {
	field?: string;
	order?: 'asc' | 'desc';
	type?: 'date' | 'number' | 'string';
}

export interface ChartSpec {
	id: string;
	title: string;
	label?: string;
	description?: string;
	descriptionHtml?: string;
	infoHtml?: string;
	chartType: ChartType;
	query: R2QueryRef;
	xAxis: ChartAxisSpec;
	xWindowDays?: number;
	yAxis?: {
		label?: string;
		min?: number;
		max?: number;
	};
	series?: ChartSeriesSpec[];
	seriesFromField?: ChartSeriesFromField;
	seriesFromColumns?: ChartSeriesFromColumns;
	legend?: boolean;
	sort?: ChartSortSpec;
}

export interface ChartRenderPlan {
	attrs: {
		title: string;
		label?: string;
		description?: string;
		chartType: ChartType;
		noLegend?: boolean;
		xLabelDensity?: number;
	};
	descriptionHtml?: string;
	infoHtml?: string;
	option: echarts.EChartsOption;
}

export function buildR2Url(query: R2QueryRef) {
	return `https://data.atlasdash.io/${query.source}/${query.dataset}/latest.json`;
}

export function buildChartRenderPlan(spec: ChartSpec, data: QueryResponseData): ChartRenderPlan {
	const option = buildChartOption(spec, data);
	const attrs: ChartRenderPlan['attrs'] = {
		title: spec.title,
		label: spec.label,
		chartType: spec.chartType,
	};
	if (spec.description && !spec.descriptionHtml) {
		attrs.description = spec.description;
	}
	if (spec.legend === false) {
		attrs.noLegend = true;
	}
	if (spec.xAxis.labelDensity) {
		attrs.xLabelDensity = spec.xAxis.labelDensity;
	}

	return {
		attrs,
		descriptionHtml: spec.descriptionHtml,
		infoHtml: spec.infoHtml,
		option,
	};
}

export function applyChartRenderPlan(
	element: HTMLElement & { setOption?: (option: echarts.EChartsOption) => void },
	plan: ChartRenderPlan
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
	element.setAttribute('chart-type', plan.attrs.chartType);
	if (plan.attrs.noLegend) {
		element.setAttribute('no-legend', '');
	} else {
		element.removeAttribute('no-legend');
	}
	if (plan.attrs.xLabelDensity) {
		element.setAttribute('x-label-density', String(plan.attrs.xLabelDensity));
	} else {
		element.removeAttribute('x-label-density');
	}

	upsertSlot(element, 'description', plan.descriptionHtml);
	upsertSlot(element, 'info', plan.infoHtml);

	if (typeof element.setOption !== 'function') {
		throw new Error('Expected <atlas-chart> element with setOption().');
	}
	element.setOption(plan.option);
}

export function buildChartOption(spec: ChartSpec, data: QueryResponseData): echarts.EChartsOption {
	const columnTypes = new Map(data.columns.map((col) => [col.name, col.type]));
	const windowedRows = applyWindow(normalizeRows(data), spec, columnTypes);
	const rows = sortRows(windowedRows, spec, data.columns);
	const xValues = getXAxisValues(rows, spec, columnTypes);
	const useTimeAxis = (spec.xAxis.type ?? 'category') === 'time';
	const xAxisType = columnTypes.get(spec.xAxis.field);
	const shouldRotateXAxis = xAxisType === 'date';

	const series: echarts.SeriesOption[] = [];

	if (spec.seriesFromField) {
		series.push(
			...buildSeriesFromField(spec, spec.seriesFromField, rows, xValues, useTimeAxis, columnTypes)
		);
	}

	if (spec.seriesFromColumns) {
		series.push(
			...buildSeriesFromColumns(spec, spec.seriesFromColumns, rows, xValues, useTimeAxis, columnTypes)
		);
	}

	if (spec.series && spec.series.length) {
		series.push(
			...spec.series.map((seriesSpec) =>
				buildSeriesFromSpec(spec, seriesSpec, rows, xValues, useTimeAxis, columnTypes)
			)
		);
	}

	const option: echarts.EChartsOption = {
		xAxis: {
			type: useTimeAxis ? 'time' : 'category',
			data: useTimeAxis ? undefined : xValues.map((value) => String(value ?? '')),
			name: spec.xAxis.label,
			axisLabel: shouldRotateXAxis ? { rotate: 35 } : undefined,
		},
		yAxis: {
			type: 'value',
			name: spec.yAxis?.label,
			min: spec.yAxis?.min,
			max: spec.yAxis?.max,
		},
		series,
	};

	return option;
}

function normalizeRows(data: QueryResponseData): QueryRow[] {
	const columnTypes = new Map(data.columns.map((col) => [col.name, col.type]));
	return data.rows.map((row) => {
		const normalized: QueryRow = {};
		Object.entries(row).forEach(([key, value]) => {
			normalized[key] = coerceValue(value, columnTypes.get(key));
		});
		return normalized;
	});
}

function coerceValue(value: QueryValue | undefined, type: string | undefined): QueryValue {
	if (type === 'number' || type === 'fixed' || type === 'float' || type === 'integer' || type === 'real') {
		const numberValue = typeof value === 'number' ? value : Number(value);
		return Number.isFinite(numberValue) ? numberValue : null;
	}
	return value ?? null;
}

function applyWindow(rows: QueryRow[], spec: ChartSpec, columnTypes: Map<string, string>): QueryRow[] {
	if (!spec.xWindowDays) {
		return rows;
	}

	const field = spec.xAxis.field;
	const xType = columnTypes.get(field);
	if (xType !== 'date') {
		return rows;
	}
	let maxTime = Number.NEGATIVE_INFINITY;
	for (const row of rows) {
		const time = toDateMs(row[field]);
		if (Number.isFinite(time) && time > maxTime) {
			maxTime = time;
		}
	}
	if (!Number.isFinite(maxTime)) {
		return rows;
	}

	const cutoff = maxTime - spec.xWindowDays * 24 * 60 * 60 * 1000;
	return rows.filter((row) => {
		const time = toDateMs(row[field]);
		return Number.isFinite(time) ? time >= cutoff : true;
	});
}

function sortRows(
	rows: QueryRow[],
	spec: ChartSpec,
	columns: QueryResponseData['columns']
): QueryRow[] {
	if (!spec.sort) {
		return rows;
	}
	const field = spec.sort.field ?? spec.xAxis.field;
	const order = spec.sort.order ?? 'asc';
	const columnTypes = new Map(columns.map((col) => [col.name, col.type]));
	const sortType = spec.sort.type ?? inferSortType(field, columnTypes.get(field));
	const factor = order === 'desc' ? -1 : 1;

	return rows.slice().sort((a, b) => compareValues(a[field], b[field], sortType) * factor);
}

function inferSortType(field: string, columnType?: string): ChartSortSpec['type'] {
	if (columnType === 'number') {
		return 'number';
	}
	if (field.toLowerCase().includes('date')) {
		return 'date';
	}
	return 'string';
}

function toDateMs(value: QueryValue) {
	if (value == null) {
		return Number.NaN;
	}
	if (typeof value === 'number') {
		if (value > 1e11) {
			return value;
		}
		if (value > 1e9) {
			return value * 1000;
		}
	}
	const parsed = Date.parse(String(value));
	return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compareValues(left: QueryValue, right: QueryValue, type: ChartSortSpec['type']) {
	if (left == null && right == null) {
		return 0;
	}
	if (left == null) {
		return 1;
	}
	if (right == null) {
		return -1;
	}
	if (type === 'number') {
		return Number(left) - Number(right);
	}
	if (type === 'date') {
		const leftTime = Date.parse(String(left));
		const rightTime = Date.parse(String(right));
		if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
			return leftTime - rightTime;
		}
	}
	return String(left).localeCompare(String(right));
}

function getXAxisValues(rows: QueryRow[], spec: ChartSpec, columnTypes: Map<string, string>) {
	const raw = rows.map((row) => coerceValue(row[spec.xAxis.field], columnTypes.get(spec.xAxis.field)));
	if (!spec.seriesFromField) {
		return raw;
	}
	const seen = new Set<string>();
	const unique: QueryValue[] = [];
	raw.forEach((value) => {
		const key = String(value ?? '');
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		unique.push(value);
	});
	return unique;
}

function resolveSeriesType(spec: ChartSpec, seriesSpec: ChartSeriesSpec): 'bar' | 'line' {
	if (seriesSpec.type === 'area') {
		return 'line';
	}
	if (seriesSpec.type === 'bar' || seriesSpec.type === 'line') {
		return seriesSpec.type;
	}
	if (spec.chartType === 'area') {
		return 'line';
	}
	if (spec.chartType === 'stacked-bar') {
		return 'bar';
	}
	return spec.chartType;
}

function buildSeriesFromSpec(
	spec: ChartSpec,
	seriesSpec: ChartSeriesSpec,
	rows: QueryRow[],
	xValues: QueryValue[],
	useTimeAxis: boolean,
	columnTypes: Map<string, string>
): echarts.SeriesOption {
	const seriesType = resolveSeriesType(spec, seriesSpec);
	const isArea = seriesType === 'line' && (seriesSpec.type === 'area' || spec.chartType === 'area');
	const values = rows.map((row) => resolveSeriesValue(row, seriesSpec, columnTypes));
	const dataPoints = useTimeAxis ? values.map((value, idx) => [xValues[idx], value]) : values;

	return {
		name: seriesSpec.name,
		type: seriesType,
		stack: seriesSpec.stack ?? (spec.chartType === 'stacked-bar' ? 'total' : undefined),
		areaStyle: isArea ? {} : undefined,
		yAxisIndex: seriesSpec.yAxisIndex,
		data: dataPoints,
	};
}

function buildSeriesFromField(
	spec: ChartSpec,
	source: ChartSeriesFromField,
	rows: QueryRow[],
	xValues: QueryValue[],
	useTimeAxis: boolean,
	columnTypes: Map<string, string>
): echarts.SeriesOption[] {
	const nameField = source.nameField;
	const valueField = source.valueField;
	const xField = spec.xAxis.field;
	const seriesNames = new Set<string>();
	const seriesMap = new Map<string, Map<string, QueryValue>>();

	rows.forEach((row) => {
		const name = row[nameField];
		if (!name) {
			return;
		}
		const nameKey = String(name);
		seriesNames.add(nameKey);
		const xValue = coerceValue(row[xField], columnTypes.get(xField));
		const xKey = String(xValue ?? '');
		const value = coerceValue(row[valueField], columnTypes.get(valueField));
		if (!seriesMap.has(nameKey)) {
			seriesMap.set(nameKey, new Map());
		}
		seriesMap.get(nameKey)?.set(xKey, value);
	});

	const sortedNames = Array.from(seriesNames.values()).sort((a, b) => a.localeCompare(b));
	return sortedNames.map((name) => {
		const seriesType = resolveSeriesType(spec, { name, type: source.type ?? spec.chartType });
		const isArea = seriesType === 'line' && (source.type === 'area' || spec.chartType === 'area');
		const values = xValues.map((xValue) => {
			const xKey = String(xValue ?? '');
			return seriesMap.get(name)?.get(xKey) ?? null;
		});
		const dataPoints = useTimeAxis ? values.map((value, idx) => [xValues[idx], value]) : values;

		return {
			name,
			type: seriesType,
			stack: source.stack ?? (spec.chartType === 'stacked-bar' ? 'total' : undefined),
			areaStyle: isArea ? {} : undefined,
			yAxisIndex: source.yAxisIndex,
			data: dataPoints,
		};
	});
}

function buildSeriesFromColumns(
	spec: ChartSpec,
	source: ChartSeriesFromColumns,
	rows: QueryRow[],
	xValues: QueryValue[],
	useTimeAxis: boolean,
	columnTypes: Map<string, string>
): echarts.SeriesOption[] {
	return source.fields.map((fieldSpec) => {
		const seriesType = resolveSeriesType(spec, { name: fieldSpec.name ?? fieldSpec.field, type: fieldSpec.type });
		const isArea = seriesType === 'line' && (fieldSpec.type === 'area' || spec.chartType === 'area');
		const values = rows.map((row) => coerceValue(row[fieldSpec.field], columnTypes.get(fieldSpec.field)));
		const dataPoints = useTimeAxis ? values.map((value, idx) => [xValues[idx], value]) : values;

		return {
			name: fieldSpec.name ?? fieldSpec.field,
			type: seriesType,
			stack: fieldSpec.stack ?? (spec.chartType === 'stacked-bar' ? 'total' : undefined),
			areaStyle: isArea ? {} : undefined,
			yAxisIndex: fieldSpec.yAxisIndex,
			data: dataPoints,
		};
	});
}

function resolveSeriesValue(
	row: QueryRow,
	seriesSpec: ChartSeriesSpec,
	columnTypes: Map<string, string>
): QueryValue {
	if (seriesSpec.field) {
		return coerceValue(row[seriesSpec.field], columnTypes.get(seriesSpec.field));
	}
	if (seriesSpec.derive) {
		const [a, b] = seriesSpec.derive.fields;
		const left = Number(coerceValue(row[a], columnTypes.get(a)));
		const right = Number(coerceValue(row[b], columnTypes.get(b)));
		if (!Number.isFinite(left) || !Number.isFinite(right)) {
			return null;
		}
		switch (seriesSpec.derive.op) {
			case 'add':
				return left + right;
			case 'subtract':
				return left - right;
			case 'multiply':
				return left * right;
			case 'divide':
				return right === 0 ? null : left / right;
		}
	}
	return null;
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
