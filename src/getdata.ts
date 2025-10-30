import type { DailyActiveUser, DAUResponseData } from './types/queried_data';

export async function fetchDAUData(): Promise<DailyActiveUser[]> {
	const res = await fetch('https://data.atlasdash.io/flipside/rq-dau-in-sb/latest.json');
	const json: DAUResponseData = await res.json();

	return json.rows
		.map((r) => ({
			date: new Date(r.DATE),
			dau: Number(r.DAU),
		}))
		.sort((a, b) => a.date.getTime() - b.date.getTime()); // ascending order
}

