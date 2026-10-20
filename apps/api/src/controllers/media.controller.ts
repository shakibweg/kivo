import { Request, Response } from 'express';
import { ENV } from '../config/env';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export interface MediaResult {
  id: string;
  /** Small preview used in the picker grid. */
  thumbUrl: string;
  /** Full URL that gets embedded into the page. */
  url: string;
  alt: string;
  width?: number;
  height?: number;
  authorName?: string;
  authorUrl?: string;
  /** Unsplash only: must be pinged when a photo is used. */
  downloadLocation?: string;
}

const PER_PAGE = 24;

async function fetchJson(url: string, label: string): Promise<any> {
  let res: globalThis.Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Version': 'v1' } });
  } catch (err: any) {
    throw new ApiError(502, `${label} is unreachable: ${err.message}`);
  }
  if (!res.ok) {
    throw new ApiError(res.status === 403 || res.status === 429 ? 429 : 502, `${label} request failed (${res.status})`);
  }
  return res.json();
}

export const mediaController = {
  /** GET /api/media/unsplash?q=&page= */
  searchUnsplash: asyncHandler(async (req: Request, res: Response) => {
    const key = ENV.MEDIA.UNSPLASH_ACCESS_KEY;
    if (!key) throw new ApiError(503, 'Unsplash is not configured. Set UNSPLASH_ACCESS_KEY on the API.');

    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const params = new URLSearchParams({ client_id: key, per_page: String(PER_PAGE), page: String(page) });
    const endpoint = q
      ? `https://api.unsplash.com/search/photos?${params}&query=${encodeURIComponent(q)}`
      : `https://api.unsplash.com/photos?${params}`;

    const json = await fetchJson(endpoint, 'Unsplash');
    const photos: any[] = Array.isArray(json) ? json : json.results || [];
    const results: MediaResult[] = photos.map((p) => ({
      id: p.id,
      thumbUrl: p.urls?.small,
      url: p.urls?.regular,
      alt: p.alt_description || p.description || 'Unsplash photo',
      width: p.width,
      height: p.height,
      authorName: p.user?.name,
      authorUrl: p.user?.links?.html ? `${p.user.links.html}?utm_source=kivo&utm_medium=referral` : undefined,
      downloadLocation: p.links?.download_location,
    }));

    return res.status(200).json(new ApiResponse(200, results, 'Unsplash results'));
  }),

  /** POST /api/media/unsplash/track — Unsplash API guideline: report a download on use. */
  trackUnsplash: asyncHandler(async (req: Request, res: Response) => {
    const key = ENV.MEDIA.UNSPLASH_ACCESS_KEY;
    const location = req.body?.downloadLocation;
    if (!key) throw new ApiError(503, 'Unsplash is not configured.');
    if (typeof location !== 'string' || !location.startsWith('https://api.unsplash.com/photos/')) {
      throw new ApiError(400, 'Invalid downloadLocation.');
    }
    const sep = location.includes('?') ? '&' : '?';
    // Fire and forget; failing to track must never block inserting the image.
    fetch(`${location}${sep}client_id=${encodeURIComponent(key)}`).catch(() => {});
    return res.status(202).json(new ApiResponse(202, { tracked: true }, 'Download tracked'));
  }),

  /** GET /api/media/giphy?q= (trending when q is empty) */
  searchGiphy: asyncHandler(async (req: Request, res: Response) => {
    const key = ENV.MEDIA.GIPHY_API_KEY;
    if (!key) throw new ApiError(503, 'GIPHY is not configured. Set GIPHY_API_KEY on the API.');

    const q = String(req.query.q || '').trim();
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const params = new URLSearchParams({
      api_key: key,
      limit: String(PER_PAGE),
      offset: String(offset),
      rating: 'g',
    });
    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?${params}&q=${encodeURIComponent(q)}`
      : `https://api.giphy.com/v1/gifs/trending?${params}`;

    const json = await fetchJson(endpoint, 'GIPHY');
    const results: MediaResult[] = (json.data || []).map((g: any) => ({
      id: g.id,
      thumbUrl: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
      url: g.images?.original?.url,
      alt: g.title || 'GIF',
      width: Number(g.images?.original?.width) || undefined,
      height: Number(g.images?.original?.height) || undefined,
      authorName: g.user?.display_name || g.username || undefined,
      authorUrl: g.url,
    }));

    return res.status(200).json(new ApiResponse(200, results, 'GIPHY results'));
  }),
};
