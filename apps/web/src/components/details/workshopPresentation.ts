import type { Workshop, WorkshopSession } from '../../types/workshop';
import { rankWorkshops } from '../../lib/rankWorkshops';
import { sessionStatus } from '../../lib/sessionStatus';
import { formatSessionDate, formatSlot } from '../../lib/format';
import { upcomingSessions } from '../../lib/workshopDetails';

export function workshopSessionRange(session: WorkshopSession) {
  const start = formatSlot(session.startsAt);
  if (
    !Number.isFinite(Date.parse(session.endsAt)) ||
    Date.parse(session.endsAt) <= Date.parse(session.startsAt)
  )
    return start;
  const from = formatSessionDate(session.startsAt, { parts: true });
  const to = formatSessionDate(session.endsAt, { parts: true });
  return `${start} – ${from.date === to.date ? to.time : formatSlot(session.endsAt)}`;
}

export function workshopText(value?: string | null) {
  const text = value?.trim() ?? '';
  return /^(khác|khac|other|unknown|n\/a|null|undefined|[-—])$/i.test(text)
    ? ''
    : text;
}

export function workshopAudience(values: string[]) {
  const labels: Record<string, string> = {
    couple: 'Cặp đôi',
    couples: 'Cặp đôi',
    solo: 'Một mình',
    friends: 'Nhóm bạn',
    family: 'Gia đình',
    families: 'Gia đình',
  };
  return [
    ...new Set(
      values
        .map(workshopText)
        .filter(Boolean)
        .map((value) => labels[value.toLowerCase()] ?? value),
    ),
  ];
}

export function workshopReviewSummary(workshop: Workshop) {
  const reviews = [...(workshop.reviews ?? [])]
    .filter(
      (review) =>
        workshopText(review.comment) &&
        Number.isFinite(review.rating) &&
        review.rating >= 1 &&
        review.rating <= 5,
    )
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt ?? '') || 0) -
        (Date.parse(a.createdAt ?? '') || 0),
    );
  const rating =
    Number.isFinite(workshop.rating) &&
    workshop.rating! >= 1 &&
    workshop.rating! <= 5
      ? workshop.rating
      : reviews.length
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : undefined;
  const reviewCount =
    Number.isInteger(workshop.reviewCount) && workshop.reviewCount! >= 0
      ? workshop.reviewCount
      : reviews.length || undefined;
  return { reviews, rating, reviewCount };
}

export function workshopSuggestions(current: Workshop, candidates: Workshop[]) {
  const priority = (item: Workshop) => {
    const category = Boolean(
      current.categoryId && item.categoryId === current.categoryId,
    );
    const city =
      current.provinceId && item.provinceId
        ? current.provinceId === item.provinceId
        : Boolean(
            current.province?.trim() &&
            item.province?.trim().toLocaleLowerCase('vi') ===
              current.province.trim().toLocaleLowerCase('vi'),
          );
    return category && city ? 0 : category ? 1 : city ? 2 : 3;
  };
  const now = Date.now();
  return rankWorkshops(
    candidates
      .filter(
        (item) =>
          item.id !== current.id &&
          !item.isDiscontinued &&
          item.sessions.some(
            (session) => sessionStatus(session, now) === 'available',
          ),
      )
      .map((item) => ({
        ...item,
        sessions: upcomingSessions(item.sessions, now),
        nextStartsAt:
          item.nextStartsAt && Date.parse(item.nextStartsAt) >= now
            ? item.nextStartsAt
            : undefined,
      })),
  )
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, 2);
}
