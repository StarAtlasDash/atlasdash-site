export interface R2QueryRef {
	source: string;
	dataset: string;
}

export type QueryValue = string | number | null;
export type QueryRow = Record<string, QueryValue>;
