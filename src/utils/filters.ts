import type { QueryResponseData } from '../types/queried_data';
import type { QueryValue } from '../types/query';
import type { Filter, FilterValue } from '../types/filter';

export function normalizeFilters(input: Filter | Filter[] | null | undefined): Filter[] {
	if (!input) {
		return [];
	}
	return Array.isArray(input) ? input.filter(Boolean) : [input];
}

export function applyFiltersToData(data: QueryResponseData, filters: Filter[]): QueryResponseData {
	if (!filters.length) {
		return data;
	}
	const availableFields = new Set(data.columns.map((col) => col.name));
	const missingFields = new Set<string>();
	const validFilters = filters.filter((filter) => {
		if (!availableFields.has(filter.field)) {
			missingFields.add(filter.field);
			return false;
		}
		return true;
	});
	if (missingFields.size) {
		missingFields.forEach((field) => {
			console.warn(`⚠️ Filter field "${field}" was not found in the dataset.`);
		});
	}
	if (!validFilters.length) {
		return data;
	}
	const filteredRows = data.rows.filter((row) =>
		validFilters.every((filter) => matchesFilter(row[filter.field], filter.value))
	);
	return { ...data, rows: filteredRows };
}

export function applyExcludeFiltersToData(data: QueryResponseData, filters: Filter[]): QueryResponseData {
	if (!filters.length) {
		return data;
	}
	const availableFields = new Set(data.columns.map((col) => col.name));
	const missingFields = new Set<string>();
	const validFilters = filters.filter((filter) => {
		if (!availableFields.has(filter.field)) {
			missingFields.add(filter.field);
			return false;
		}
		return true;
	});
	if (missingFields.size) {
		missingFields.forEach((field) => {
			console.warn(`⚠️ Exclude filter field "${field}" was not found in the dataset.`);
		});
	}
	if (!validFilters.length) {
		return data;
	}
	const filteredRows = data.rows.filter(
		(row) => !validFilters.some((filter) => matchesFilter(row[filter.field], filter.value))
	);
	return { ...data, rows: filteredRows };
}

export function resolveFilterOverrides(filters: Filter[]) {
	let description: string | undefined;
	let info: string | undefined;
	let colorscheme: string[] | undefined;
	filters.forEach((filter) => {
		if (filter.description) {
			description = filter.description;
		}
		if (filter.info) {
			info = filter.info;
		}
		if (filter.colorscheme && filter.colorscheme.length) {
			colorscheme = filter.colorscheme;
		}
	});
	return { description, info, colorscheme };
}

function matchesFilter(value: QueryValue, filterValue: FilterValue) {
	const candidates = Array.isArray(filterValue) ? filterValue : [filterValue];
	if (value == null) {
		return candidates.some((candidate) => String(candidate ?? '').trim() === '');
	}
	const normalized = normalizeValue(value);
	return candidates.some((candidate) => compareValues(normalized, candidate));
}

function normalizeValue(value: QueryValue) {
	if (typeof value === 'number') {
		return value;
	}
	const trimmed = String(value).trim();
	if (!trimmed) {
		return '';
	}
	const numeric = Number(trimmed.replace(/,/g, ''));
	return Number.isFinite(numeric) ? numeric : trimmed;
}

function compareValues(rowValue: string | number, filterValue: string | number) {
	if (typeof filterValue === 'number') {
		const numeric = typeof rowValue === 'number' ? rowValue : Number(rowValue);
		return Number.isFinite(numeric) && numeric === filterValue;
	}
	return String(rowValue).toLowerCase() === String(filterValue).toLowerCase();
}
