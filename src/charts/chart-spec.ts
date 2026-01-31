import type * as echarts from 'echarts';
import type { QueryResponseData } from '../types/queried_data';
import type { QueryRow, QueryValue, R2QueryRef } from '../types/query';
import { renderMarkdown } from '../utils/markdown';

export type ChartType = 'bar' | 'line' | 'area' | 'stacked-bar';

export interface ChartAxisSpec {
	field: string;
	type?: 'category' | 'time';
	label?: string;
	labelDensity?: number;
}

export interface ChartZoomSpec {
	enabled?: boolean;
	showSlider?: boolean;
	inside?: boolean;
	showDataShadow?: 'auto' | boolean;
	shadowField?: string;
	shadowSeriesName?: string;
	start?: number;
	end?: number;
	startValue?: string | number;
	endValue?: string | number;
	windowDays?: number;
	windowPoints?: number;
	filterMode?: 'filter' | 'weakFilter' | 'empty' | 'none';
	zoomLock?: boolean;
	brushSelect?: boolean;
	height?: number;
	bottom?: number | string;
	gridBottom?: number;
}

export interface ChartYAxisSpec {
	label?: string;
	min?: number;
	max?: number;
	position?: 'left' | 'right';
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
	descriptionMd?: string;
	descriptionHtml?: string;
	infoMd?: string;
	infoHtml?: string;
	chartType: ChartType;
	query: R2QueryRef;
	xAxis: ChartAxisSpec;
	xWindowDays?: number;
	xZoom?: ChartZoomSpec;
	enableSecondaryAxis?: boolean;
	lockYAxisMax?: boolean;
	yAxisMaxRound?: boolean;
	yAxis?: ChartYAxisSpec;
	yAxes?: ChartYAxisSpec[];
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
	const descriptionContent = spec.descriptionMd ?? spec.descriptionHtml ?? spec.description;
	const infoContent = spec.infoMd ?? spec.infoHtml;
	const descriptionHtml = descriptionContent ? renderMarkdown(descriptionContent) : undefined;
	const infoHtml = infoContent ? renderMarkdown(infoContent) : undefined;
	const attrs: ChartRenderPlan['attrs'] = {
		title: spec.title,
		label: spec.label,
		chartType: spec.chartType,
	};
	if (spec.description && !descriptionHtml) {
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
		descriptionHtml,
		infoHtml,
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
	upsertPopupSlot(element, 'info', plan.infoHtml);

	if (typeof element.setOption !== 'function') {
		throw new Error('Expected <atlas-chart> element with setOption().');
	}
	element.setOption(plan.option);
}

export function buildChartOption(spec: ChartSpec, data: QueryResponseData): echarts.EChartsOption {
	const columnTypes = new Map(data.columns.map((col) => [col.name, col.type]));
	const columnNames = new Set(columnTypes.keys());
	assertColumn(columnNames, spec.xAxis.field, 'xAxis.field', spec.id);

	const seriesFromField = spec.seriesFromField;
	if (seriesFromField) {
		assertColumn(columnNames, seriesFromField.nameField, 'seriesFromField.nameField', spec.id);
		assertColumn(columnNames, seriesFromField.valueField, 'seriesFromField.valueField', spec.id);
	}

	const seriesFromColumns = spec.seriesFromColumns
		? filterSeriesColumns(spec.seriesFromColumns, columnNames, spec.id)
		: undefined;
	const explicitSeries = spec.series ? filterExplicitSeries(spec.series, columnNames, spec.id) : undefined;
	const zoomSpec = spec.xZoom ? normalizeZoomSpec(spec.xZoom, columnNames, spec.id) : undefined;
	const effectiveSpec = zoomSpec ? { ...spec, xZoom: zoomSpec } : spec;

	const windowedRows = applyWindow(normalizeRows(data), spec, columnTypes);
	const rows = sortRows(windowedRows, spec, data.columns);
	const xValues = getXAxisValues(rows, spec, columnTypes);
	const useTimeAxis = (spec.xAxis.type ?? 'category') === 'time';
	const xAxisType = columnTypes.get(spec.xAxis.field);
	const shouldRotateXAxis = xAxisType === 'date';
	const allowSecondaryAxis = !!spec.enableSecondaryAxis;
	const lockYAxisMax = spec.lockYAxisMax !== false;
	const roundYAxisMax = spec.yAxisMaxRound !== false;

	const series: echarts.SeriesOption[] = [];

	if (spec.seriesFromField) {
		series.push(
			...buildSeriesFromField(spec, seriesFromField!, rows, xValues, useTimeAxis, columnTypes)
		);
	}

	if (seriesFromColumns) {
		series.push(
			...buildSeriesFromColumns(spec, seriesFromColumns, rows, xValues, useTimeAxis, columnTypes)
		);
	}

	if (explicitSeries && explicitSeries.length) {
		series.push(
			...explicitSeries.map((seriesSpec) =>
				buildSeriesFromSpec(spec, seriesSpec, rows, xValues, useTimeAxis, columnTypes)
			)
		);
	}

	const zoomConfig = buildDataZoom(effectiveSpec, xValues, columnTypes, useTimeAxis);
	const normalizedSeries = allowSecondaryAxis ? series : series.map((item) => normalizeSeriesAxis(item));
	const shadowConfig = buildShadowSeries(effectiveSpec, normalizedSeries, rows, xValues, useTimeAxis, columnTypes);
	const seriesForOption = shadowConfig?.series ?? normalizedSeries;

	const option: echarts.EChartsOption = {
		xAxis: {
			type: useTimeAxis ? 'time' : 'category',
			data: useTimeAxis ? undefined : xValues.map((value) => String(value ?? '')),
			name: spec.xAxis.label,
			axisLabel: shouldRotateXAxis ? { rotate: 35 } : undefined,
		},
		yAxis: buildYAxis(spec, normalizedSeries, allowSecondaryAxis),
		series: seriesForOption,
	};
	if (shadowConfig?.legendData.length) {
		option.legend = { data: shadowConfig.legendData };
	}
	if (zoomConfig?.items.length) {
		option.dataZoom = zoomConfig.items;
	}
	if (zoomConfig?.gridBottom !== undefined) {
		option.grid = { bottom: zoomConfig.gridBottom };
	}
	if (lockYAxisMax) {
		applyFixedYAxisMax(option, normalizedSeries, spec, allowSecondaryAxis, roundYAxisMax);
	}

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

function assertColumn(columns: Set<string>, field: string, context: string, chartId: string) {
	if (!columns.has(field)) {
		throw new Error(`[chart-spec:${chartId}] Missing column "${field}" referenced in ${context}.`);
	}
}

function warnMissingColumn(field: string, context: string, chartId: string) {
	console.warn(`[chart-spec:${chartId}] Missing column "${field}" referenced in ${context}.`);
}

function filterSeriesColumns(
	seriesFromColumns: ChartSeriesFromColumns,
	columns: Set<string>,
	chartId: string
): ChartSeriesFromColumns {
	const fields = seriesFromColumns.fields.filter((field) => {
		const exists = columns.has(field.field);
		if (!exists) {
			warnMissingColumn(field.field, 'seriesFromColumns.fields', chartId);
		}
		return exists;
	});
	return { fields };
}

function filterExplicitSeries(
	series: ChartSeriesSpec[],
	columns: Set<string>,
	chartId: string
): ChartSeriesSpec[] {
	return series.filter((entry) => {
		if (entry.field) {
			if (!columns.has(entry.field)) {
				warnMissingColumn(entry.field, 'series.field', chartId);
				return false;
			}
			return true;
		}
		if (entry.derive) {
			const [a, b] = entry.derive.fields;
			let ok = true;
			if (!columns.has(a)) {
				warnMissingColumn(a, 'series.derive.fields[0]', chartId);
				ok = false;
			}
			if (!columns.has(b)) {
				warnMissingColumn(b, 'series.derive.fields[1]', chartId);
				ok = false;
			}
			return ok;
		}
		console.warn(`[chart-spec:${chartId}] Series "${entry.name}" has no field or derive.`);
		return false;
	});
}

function normalizeZoomSpec(zoom: ChartZoomSpec, columns: Set<string>, chartId: string): ChartZoomSpec {
	if (zoom.shadowField && !columns.has(zoom.shadowField)) {
		warnMissingColumn(zoom.shadowField, 'xZoom.shadowField', chartId);
		const { shadowField, ...rest } = zoom;
		return rest;
	}
	return zoom;
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

function makeSeriesOption(params: {
	name: string;
	seriesType: 'bar' | 'line';
	stack?: string;
	isArea: boolean;
	yAxisIndex?: number;
	values: QueryValue[];
	xValues: QueryValue[];
	useTimeAxis: boolean;
}): echarts.SeriesOption {
	const data = params.useTimeAxis
		? params.values.map((value, idx) => [params.xValues[idx], value])
		: params.values;
	const isLine = params.seriesType === 'line';
	return {
		name: params.name,
		type: params.seriesType,
		stack: params.stack,
		areaStyle: params.isArea ? {} : undefined,
		yAxisIndex: params.yAxisIndex,
		...(isLine ? { showSymbol: false, symbol: 'none' } : {}),
		data,
	};
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
	const defaultStack = spec.chartType === 'stacked-bar' && seriesType === 'bar' ? 'total' : undefined;
	const values = rows.map((row) => resolveSeriesValue(row, seriesSpec, columnTypes));

	return makeSeriesOption({
		name: seriesSpec.name,
		seriesType,
		stack: seriesSpec.stack ?? defaultStack,
		isArea,
		yAxisIndex: seriesSpec.yAxisIndex,
		values,
		xValues,
		useTimeAxis,
	});
}

function buildSeriesFromField(
	spec: ChartSpec,
	source: ChartSeriesFromField,
	rows: QueryRow[],
	xValues: QueryValue[],
	useTimeAxis: boolean,
	columnTypes: Map<string, string>
): echarts.SeriesOption[] {
	const chartSeriesType = spec.chartType === 'stacked-bar' ? 'bar' : spec.chartType;
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
		const seriesType = resolveSeriesType(spec, { name, type: source.type ?? chartSeriesType });
		const isArea = seriesType === 'line' && (source.type === 'area' || spec.chartType === 'area');
		const defaultStack = spec.chartType === 'stacked-bar' && seriesType === 'bar' ? 'total' : undefined;
		const values = xValues.map((xValue) => {
			const xKey = String(xValue ?? '');
			return seriesMap.get(name)?.get(xKey) ?? null;
		});

		return makeSeriesOption({
			name,
			seriesType,
			stack: source.stack ?? defaultStack,
			isArea,
			yAxisIndex: source.yAxisIndex,
			values,
			xValues,
			useTimeAxis,
		});
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
	const chartSeriesType = spec.chartType === 'stacked-bar' ? 'bar' : spec.chartType;
	return source.fields.map((fieldSpec) => {
		const seriesType = resolveSeriesType(spec, {
			name: fieldSpec.name ?? fieldSpec.field,
			type: fieldSpec.type ?? chartSeriesType,
		});
		const isArea = seriesType === 'line' && (fieldSpec.type === 'area' || spec.chartType === 'area');
		const defaultStack = spec.chartType === 'stacked-bar' && seriesType === 'bar' ? 'total' : undefined;
		const values = rows.map((row) => coerceValue(row[fieldSpec.field], columnTypes.get(fieldSpec.field)));

		return makeSeriesOption({
			name: fieldSpec.name ?? fieldSpec.field,
			seriesType,
			stack: fieldSpec.stack ?? defaultStack,
			isArea,
			yAxisIndex: fieldSpec.yAxisIndex,
			values,
			xValues,
			useTimeAxis,
		});
	});
}

function buildYAxis(
	spec: ChartSpec,
	series: echarts.SeriesOption[],
	allowSecondaryAxis: boolean
): echarts.EChartsOption['yAxis'] {
	const primary = spec.yAxis ?? spec.yAxes?.[0] ?? {};
	if (!allowSecondaryAxis) {
		return {
			type: 'value' as const,
			name: primary.label,
			min: primary.min,
			max: primary.max,
			position: primary.position,
		};
	}

	if (spec.yAxes && spec.yAxes.length) {
		const axes = spec.yAxes.map((axis, index) => ({
			type: 'value' as const,
			name: axis.label,
			min: axis.min,
			max: axis.max,
			position: axis.position ?? (index === 1 ? 'right' : 'left'),
		}));
		return axes.length === 1 ? axes[0] : axes;
	}

	const maxIndex = series.reduce((max, item) => {
		const yAxisIndex = (item as { yAxisIndex?: number }).yAxisIndex ?? 0;
		return Math.max(max, yAxisIndex);
	}, 0);

	if (maxIndex > 0) {
		return [
			{
				type: 'value' as const,
				name: primary.label,
				min: primary.min,
				max: primary.max,
				position: primary.position ?? 'left',
			},
			{
				type: 'value' as const,
				position: 'right',
			},
		];
	}

	return {
		type: 'value' as const,
		name: primary.label,
		min: primary.min,
		max: primary.max,
		position: primary.position,
	};
}

function normalizeSeriesAxis(series: echarts.SeriesOption): echarts.SeriesOption {
	if (!series || typeof series !== 'object') {
		return series;
	}
	if ('yAxisIndex' in series) {
		return { ...(series as Record<string, unknown>), yAxisIndex: 0 };
	}
	return series;
}

function buildShadowSeries(
	spec: ChartSpec,
	series: echarts.SeriesOption[],
	rows: QueryRow[],
	xValues: QueryValue[],
	useTimeAxis: boolean,
	columnTypes: Map<string, string>
): { series: echarts.SeriesOption[]; legendData: string[] } | null {
	const zoom = spec.xZoom;
	if (!zoom) {
		return null;
	}
	const shadowSeriesName = zoom.shadowSeriesName;
	const shadowField = zoom.shadowField;
	if (!shadowSeriesName && !shadowField) {
		return null;
	}

	let shadowData: Array<QueryValue | [QueryValue, QueryValue]> | null = null;
	if (shadowSeriesName) {
		const target = series.find((item) => (item as { name?: string }).name === shadowSeriesName);
		const data = target && (target as { data?: Array<QueryValue | [QueryValue, QueryValue]> }).data;
		if (Array.isArray(data)) {
			shadowData = data;
		}
	}

	if (!shadowData && shadowField) {
		const xField = spec.xAxis.field;
		const xType = columnTypes.get(xField);
		const valueType = columnTypes.get(shadowField);
		const sums = new Map<string, number>();

		rows.forEach((row) => {
			const rawX = coerceValue(row[xField], xType);
			const xKey = String(rawX ?? '');
			const rawValue = coerceValue(row[shadowField], valueType);
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
			if (!Number.isFinite(value)) {
				return;
			}
			sums.set(xKey, (sums.get(xKey) ?? 0) + value);
		});

		const values = xValues.map((xValue) => sums.get(String(xValue ?? '')) ?? null);
		shadowData = useTimeAxis ? values.map((value, idx) => [xValues[idx], value]) : values;
	}

	if (!shadowData) {
		return null;
	}

	const shadowSeries: echarts.SeriesOption = {
		name: '__shadow__',
		type: 'line',
		data: shadowData,
		showSymbol: false,
		silent: true,
		z: 0,
		zlevel: 0,
		lineStyle: { opacity: 0 },
		areaStyle: { opacity: 0 },
		itemStyle: { opacity: 0 },
		emphasis: { disabled: true },
		tooltip: { show: false },
	};

	const legendData = series
		.map((item) => (item as { name?: string }).name)
		.filter((name): name is string => !!name);

	return {
		series: [shadowSeries, ...series],
		legendData,
	};
}

function applyFixedYAxisMax(
	option: echarts.EChartsOption,
	series: echarts.SeriesOption[],
	spec: ChartSpec,
	allowSecondaryAxis: boolean,
	roundYAxisMax: boolean
) {
	const axisMax = computeAxisMax(series);
	if (!axisMax.size) {
		return;
	}

	if (Array.isArray(option.yAxis)) {
		option.yAxis = option.yAxis.map((axis, index) => {
			const axisRecord = axis as Record<string, unknown>;
			if (axisRecord.max !== undefined) {
				return axis;
			}
			const specMax = allowSecondaryAxis ? spec.yAxes?.[index]?.max : spec.yAxis?.max;
			if (specMax !== undefined) {
				return axis;
			}
			const max = maybeRoundAxisMax(axisMax.get(index), roundYAxisMax);
			if (max === undefined) {
				return axis;
			}
			return { ...(axis as Record<string, unknown>), max };
		});
		return;
	}

	if (option.yAxis) {
		const axisRecord = option.yAxis as Record<string, unknown>;
		if (axisRecord.max !== undefined) {
			return;
		}
		const specMax = spec.yAxis?.max ?? (allowSecondaryAxis ? spec.yAxes?.[0]?.max : undefined);
		if (specMax !== undefined) {
			return;
		}
		const max = maybeRoundAxisMax(axisMax.get(0), roundYAxisMax);
		if (max !== undefined) {
			option.yAxis = { ...(option.yAxis as Record<string, unknown>), max };
		}
	}
}

function maybeRoundAxisMax(max: number | undefined, roundYAxisMax: boolean) {
	if (max === undefined) {
		return undefined;
	}
	if (!roundYAxisMax) {
		return max;
	}
	return trimAxisMax(max);
}

function trimAxisMax(value: number) {
	if (!Number.isFinite(value) || value <= 0) {
		return value;
	}
	const padded = value * 1.1;
	const exponent = Math.floor(Math.log10(padded));
	const base = Math.pow(10, exponent - 1);
	if (!Number.isFinite(base) || base === 0) {
		return padded;
	}
	return Math.floor(padded / base) * base;
}

function computeAxisMax(series: echarts.SeriesOption[]): Map<number, number> {
	const maxByAxis = new Map<number, number>();
	const stackTotals = new Map<number, Map<string, number[]>>();

	series.forEach((item) => {
		const record = item as { data?: unknown; yAxisIndex?: number; stack?: string };
		if (!Array.isArray(record.data)) {
			return;
		}
		const axisIndex = record.yAxisIndex ?? 0;
		const stackKey = record.stack;
		if (stackKey) {
			const axisStacks = stackTotals.get(axisIndex) ?? new Map<string, number[]>();
			const sums = axisStacks.get(stackKey) ?? new Array(record.data.length).fill(0);
			record.data.forEach((point, idx) => {
				const value = extractNumericValue(point);
				if (value === null) {
					return;
				}
				sums[idx] += value;
			});
			axisStacks.set(stackKey, sums);
			stackTotals.set(axisIndex, axisStacks);
			return;
		}

		record.data.forEach((point) => {
			const value = extractNumericValue(point);
			if (value === null) {
				return;
			}
			const current = maxByAxis.get(axisIndex);
			if (current === undefined || value > current) {
				maxByAxis.set(axisIndex, value);
			}
		});
	});

	stackTotals.forEach((axisStacks, axisIndex) => {
		axisStacks.forEach((sums) => {
			let max = Number.NEGATIVE_INFINITY;
			sums.forEach((value) => {
				if (value > max) {
					max = value;
				}
			});
			if (Number.isFinite(max)) {
				const current = maxByAxis.get(axisIndex);
				if (current === undefined || max > current) {
					maxByAxis.set(axisIndex, max);
				}
			}
		});
	});

	return maxByAxis;
}

function extractNumericValue(point: unknown): number | null {
	if (point == null) {
		return null;
	}
	if (typeof point === 'number') {
		return Number.isFinite(point) ? point : null;
	}
	if (Array.isArray(point)) {
		const value = point[1];
		if (typeof value === 'number') {
			return Number.isFinite(value) ? value : null;
		}
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	if (typeof point === 'object' && point !== null && 'value' in point) {
		return extractNumericValue((point as { value?: unknown }).value);
	}
	const parsed = Number(point);
	return Number.isFinite(parsed) ? parsed : null;
}

function buildDataZoom(
	spec: ChartSpec,
	xValues: QueryValue[],
	columnTypes: Map<string, string>,
	useTimeAxis: boolean
): { items: echarts.DataZoomComponentOption[]; gridBottom?: number } | null {
	const zoom = spec.xZoom;
	if (!zoom || zoom.enabled === false) {
		return null;
	}

	const showSlider = zoom.showSlider ?? true;
	const showInside = zoom.inside ?? true;
	if (!showSlider && !showInside) {
		return null;
	}

	const window = resolveZoomWindow(zoom, xValues, columnTypes, spec, useTimeAxis);
	const base: echarts.DataZoomComponentOption = {
		xAxisIndex: 0,
		filterMode: zoom.filterMode ?? 'filter',
	};
	const items: echarts.DataZoomComponentOption[] = [];

	if (showSlider) {
		items.push({
			...base,
			type: 'slider',
			height: zoom.height,
			bottom: zoom.bottom,
			showDataShadow: zoom.showDataShadow,
			zoomLock: zoom.zoomLock,
			brushSelect: zoom.brushSelect,
			...window,
		});
	}

	if (showInside) {
		items.push({
			...base,
			type: 'inside',
			zoomLock: zoom.zoomLock,
			...window,
		});
	}

	const sliderHeight = zoom.height ?? 24;
	const gridBottom = zoom.gridBottom ?? (showSlider ? Math.max(40, sliderHeight + 28) : undefined);
	return { items, gridBottom };
}

function resolveZoomWindow(
	zoom: ChartZoomSpec,
	xValues: QueryValue[],
	columnTypes: Map<string, string>,
	spec: ChartSpec,
	useTimeAxis: boolean
) {
	if (zoom.startValue !== undefined || zoom.endValue !== undefined) {
		return {
			startValue: zoom.startValue,
			endValue: zoom.endValue,
			start: zoom.start,
			end: zoom.end,
		};
	}
	if (zoom.start !== undefined || zoom.end !== undefined) {
		return { start: zoom.start, end: zoom.end };
	}

	const windowDays = zoom.windowDays ? Math.max(1, zoom.windowDays) : 0;
	const windowPoints = zoom.windowPoints ? Math.max(1, zoom.windowPoints) : 0;
	if (!windowDays && !windowPoints) {
		return {};
	}

	const axisType = columnTypes.get(spec.xAxis.field);
	if (windowDays && axisType === 'date') {
		let maxTime = Number.NEGATIVE_INFINITY;
		xValues.forEach((value) => {
			const time = toDateMs(value);
			if (Number.isFinite(time) && time > maxTime) {
				maxTime = time;
			}
		});
		if (!Number.isFinite(maxTime)) {
			return {};
		}
		const cutoff = maxTime - windowDays * 24 * 60 * 60 * 1000;
		let startIndex = -1;
		for (let i = 0; i < xValues.length; i += 1) {
			const time = toDateMs(xValues[i]);
			if (Number.isFinite(time) && time >= cutoff) {
				startIndex = i;
				break;
			}
		}
		if (startIndex >= 0) {
			const startValue = normalizeZoomValue(xValues[startIndex], useTimeAxis);
			const endValue = normalizeZoomValue(xValues[xValues.length - 1], useTimeAxis);
			if (startValue === undefined && endValue === undefined) {
				return {};
			}
			return { startValue, endValue };
		}
	}

	if (windowPoints && xValues.length) {
		const startIndex = Math.max(0, xValues.length - windowPoints);
		const startValue = normalizeZoomValue(xValues[startIndex], useTimeAxis);
		const endValue = normalizeZoomValue(xValues[xValues.length - 1], useTimeAxis);
		if (startValue === undefined && endValue === undefined) {
			return {};
		}
		return { startValue, endValue };
	}

	return {};
}

function normalizeZoomValue(value: QueryValue, useTimeAxis: boolean) {
	if (useTimeAxis) {
		const time = toDateMs(value);
		return Number.isFinite(time) ? time : undefined;
	}
	if (value == null) {
		return undefined;
	}
	return String(value);
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

function upsertPopupSlot(element: HTMLElement, slotName: string, html?: string) {
	const popup = element.shadowRoot?.querySelector('atlas-popup.info-popup') as HTMLElement | null;
	if (popup) {
		upsertSlot(popup, slotName, html);
		return;
	}
	upsertSlot(element, slotName, html);
}
