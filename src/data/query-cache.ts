import type { QueryResponseData } from '../types/queried_data';
import type { R2QueryRef } from '../types/query';
import { fetchQueryData } from '../getdata';

const CACHE_PREFIX = 'atlasdash:r2:';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const inFlight = new Map<string, Promise<QueryResponseData>>();

type CachedPayload = {
	timestamp: number;
	data: QueryResponseData;
};

function getCacheKey(ref: R2QueryRef) {
	return `${CACHE_PREFIX}${ref.source}/${ref.dataset}`;
}

function readCache(key: string): CachedPayload | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as CachedPayload;
		if (!parsed || typeof parsed.timestamp !== 'number' || !parsed.data) {
			return null;
		}
		return parsed;
	} catch (error) {
		console.warn('Failed to read table/chart cache.', error);
		return null;
	}
}

function writeCache(key: string, data: QueryResponseData) {
	try {
		const payload: CachedPayload = { timestamp: Date.now(), data };
		localStorage.setItem(key, JSON.stringify(payload));
	} catch (error) {
		console.warn('Failed to write table/chart cache.', error);
	}
}

export async function getQueryData(
	ref: R2QueryRef,
	options?: { ttlMs?: number }
): Promise<QueryResponseData> {
	const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
	const cacheKey = getCacheKey(ref);
	const cached = readCache(cacheKey);
	if (cached && Date.now() - cached.timestamp < ttlMs) {
		return cached.data;
	}

	if (inFlight.has(cacheKey)) {
		return inFlight.get(cacheKey)!;
	}

	const request = fetchQueryData(ref)
		.then((data) => {
			writeCache(cacheKey, data);
			return data;
		})
		.finally(() => {
			inFlight.delete(cacheKey);
		});

	inFlight.set(cacheKey, request);
	return request;
}
