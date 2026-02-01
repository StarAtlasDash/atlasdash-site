import type { QueryResponseData } from './types/queried_data';
import type { R2QueryRef } from './types/query';

export async function fetchQueryData(query: R2QueryRef): Promise<QueryResponseData> {
	const url = `https://data.atlasdash.io/${query.source}/${query.dataset}/latest.json`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url} (${res.status}).`);
	}
	return res.json();
}
