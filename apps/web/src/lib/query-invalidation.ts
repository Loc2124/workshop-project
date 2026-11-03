import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys, type Resource } from './query-keys';
export async function invalidateResources(
  client: QueryClient,
  userId: string | undefined,
  resources: Resource[],
) {
  const keys: QueryKey[] = resources.flatMap((name) => {
    const group =
      name === 'workshopReviews'
        ? queryKeys.workshops.reviews
        : queryKeys[name];
    return [group.lists(userId), group.counts(userId)];
  });
  if (resources.includes('studios')) keys.push(queryKeys.studios.mine(userId));
  if (resources.includes('workshops'))
    keys.push(
      queryKeys.workshops.studioLists(userId),
      queryKeys.workshops.reviews.lists(userId),
      queryKeys.workshops.reviews.counts(userId),
    );
  if (resources.includes('bookings'))
    keys.push(queryKeys.bookings.slotLists(userId));
  keys.push(
    queryKeys.overview.config(userId),
    queryKeys.audit.lists(userId),
    queryKeys.audit.config(userId),
  );
  await Promise.all(
    keys.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
export async function invalidatePublicCatalog(client: QueryClient) {
  await Promise.all(
    [
      queryKeys.public.studios,
      queryKeys.public.workshops,
      queryKeys.public.home,
      queryKeys.public.categorySource,
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
