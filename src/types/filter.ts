export type FilterValue = string | number | string[] | number[];

export interface Filter {
	field: string;
	value: FilterValue;
	description?: string;
	info?: string;
	colorscheme?: string[];
}
