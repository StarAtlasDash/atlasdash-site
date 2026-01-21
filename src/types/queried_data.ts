import type { QueryRow } from './query';

export interface QueriedData<T> {
	columns: {
		name: string;
		type: string;
	}[];
	rows: T[];
	rowCount: number;
}

export interface QueryResponseData extends QueriedData<QueryRow> {
	rows: QueryRow[];
}
