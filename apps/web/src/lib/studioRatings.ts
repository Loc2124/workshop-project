import type { Workshop } from '../types/workshop';
import { upcomingSessions } from './workshopDetails';

export function weightedRating(
  items: { rating?: number; reviewCount?: number }[],
) {
  const valid = items.filter(
    (item) =>
      Number.isFinite(item.rating) &&
      item.rating! >= 1 &&
      item.rating! <= 5 &&
      Number.isInteger(item.reviewCount) &&
      item.reviewCount! > 0,
  );
  const reviewCount = valid.reduce((sum, item) => sum + item.reviewCount!, 0);
  return {
    reviewCount,
    rating: reviewCount
      ? valid.reduce((sum, item) => sum + item.rating! * item.reviewCount!, 0) /
        reviewCount
      : undefined,
  };
}

export function studioArtisans(workshops: Workshop[]) {
  const groups = new Map<string, Workshop[]>();
  workshops.forEach((item) => {
    const name = item.artistName?.trim();
    if (name) groups.set(name, [...(groups.get(name) ?? []), item]);
  });
  return [...groups].map(([name, items]) => {
    const nextSession = upcomingSessions(
      items.flatMap((item) => item.sessions),
    )[0];
    const nearest =
      items.find((item) =>
        item.sessions.some((session) => session.id === nextSession?.id),
      ) ?? items[0];
    return {
      name,
      photo: items.find((item) => item.artistPhoto)?.artistPhoto,
      intro: items.find((item) => item.artistIntro?.trim())?.artistIntro,
      workshops: items,
      nearestTitle: nearest.title,
      ...weightedRating(items),
    };
  });
}

export function studioRating(workshops: Workshop[]) {
  return weightedRating(studioArtisans(workshops));
}
