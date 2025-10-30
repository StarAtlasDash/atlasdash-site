interface QueriedData<T> {
	columns: {
		name: string;
		type: string;
	}[];
	rows: T[];
	rowCount: number;
}

export interface DAURow {
	DATE: string; // e.g. "2025-10-26"
	DAU: string; // stored as string, but numeric
}

export interface DAUResponseData extends QueriedData<DAURow> {
	rows: DAURow[];
}
