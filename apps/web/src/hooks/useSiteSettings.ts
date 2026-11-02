import { useQuery } from '@tanstack/react-query';
import { siteSettingsSchema } from '@workshop/shared';
import { z } from 'zod';
import { apiFetch } from '../lib/api-client';
export async function fetchSiteSettings(signal?: AbortSignal) {
  return z
    .object({ settings: siteSettingsSchema })
    .parse(await apiFetch('/settings', { signal })).settings;
}
export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: ({ signal }) => fetchSiteSettings(signal),
    staleTime: 60000,
  });
}
