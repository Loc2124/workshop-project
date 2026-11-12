import type { Workshop } from '@/types/workshop';
import { workshopSearchScore } from './search';

export function rankWorkshops(list: Workshop[], query = ''): Workshop[] {
  const time = (value?: string) => {
    const timestamp = value ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? timestamp : Infinity;
  };
  return list
    .map((workshop) => ({
      ...workshop,
      sessions: [...workshop.sessions].sort(
        (a, b) => time(a.startsAt) - time(b.startsAt),
      ),
    }))
    .sort((a, b) => {
      const relevance = query.trim()
        ? workshopSearchScore(b, query) - workshopSearchScore(a, query)
        : 0;
      if (relevance) return relevance;
      const trust =
        Number(b.studioTrustLevel === 'verified') -
        Number(a.studioTrustLevel === 'verified');
      if (trust) return trust;
      const first = time(a.sessions[0]?.startsAt ?? a.nextStartsAt);
      const second = time(b.sessions[0]?.startsAt ?? b.nextStartsAt);
      return first === second ? 0 : first - second;
    });
}
