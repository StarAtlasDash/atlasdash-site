import type { QueryResponseData } from './types/queried_data';
import type { R2QueryRef } from './types/query';

export async function fetchQueryData(query: R2QueryRef): Promise<QueryResponseData> {
	const res = await fetch(`https://data.atlasdash.io/${query.source}/${query.dataset}/latest.json`);
	return res.json();
}
