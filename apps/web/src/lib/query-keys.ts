export type Resource =
  | 'studios'
  | 'workshops'
  | 'workshopReviews'
  | 'bookings'
  | 'users'
  | 'reports'
  | 'audit'
  | 'categories'
  | 'templates'
  | 'featured'
  | 'settings'
  | 'notifications'
  | 'overview'
  | 'options';
const root = (userId: string | undefined, resource: Resource) =>
  ['private', userId ?? 'anonymous', resource] as const;
function resource(name: Resource) {
  return {
    all: (id: string | undefined) => root(id, name),
    lists: (id: string | undefined) => [...root(id, name), 'lists'] as const,
    list: (id: string | undefined, filters: unknown) =>
      [...root(id, name), 'lists', filters] as const,
    detail: (id: string | undefined, target: string | undefined) =>
      [...root(id, name), 'detail', target] as const,
    counts: (id: string | undefined, filters?: unknown) =>
      filters === undefined
        ? ([...root(id, name), 'counts'] as const)
        : ([...root(id, name), 'counts', filters] as const),
    config: (id: string | undefined) => [...root(id, name), 'config'] as const,
  };
}
export const queryKeys = {
  studios: {
    ...resource('studios'),
    mine: (id: string | undefined) => [...root(id, 'studios'), 'mine'] as const,
    images: (id: string | undefined, studioId: string | undefined) =>
      [...root(id, 'studios'), 'images', studioId] as const,
  },
  workshops: {
    ...resource('workshops'),
    reviews: resource('workshopReviews'),
    reviewLists: (id: string | undefined) =>
      [...root(id, 'workshopReviews'), 'lists'] as const,
    forStudio: (id: string | undefined, studio: string) =>
      [...root(id, 'workshops'), 'studio', studio] as const,
    studioLists: (id: string | undefined) =>
      [...root(id, 'workshops'), 'studio'] as const,
  },
  bookings: {
    ...resource('bookings'),
    slots: (id: string | undefined, studio: string) =>
      [...root(id, 'bookings'), 'slots', studio] as const,
    slotLists: (id: string | undefined) =>
      [...root(id, 'bookings'), 'slots'] as const,
  },
  users: resource('users'),
  reports: resource('reports'),
  audit: resource('audit'),
  categories: resource('categories'),
  templates: resource('templates'),
  featured: resource('featured'),
  settings: resource('settings'),
  notifications: resource('notifications'),
  overview: resource('overview'),
  options: resource('options'),
  admin: {
    counts: (id: string | undefined, name: Resource) =>
      [...root(id, name), 'counts'] as const,
  },
  public: {
    workshops: ['catalog', 'workshops'] as const,
    studios: ['catalog', 'studios'] as const,
    home: ['catalog', 'home-featured', 'public'] as const,
    categorySource: ['catalog', 'category-source'] as const,
    categories: ['categories'] as const,
    settings: ['site-settings'] as const,
  },
};
export function scopePrivateKey(
  userId: string | undefined,
  key: readonly unknown[],
) {
  return key[0] === 'private'
    ? ['private', userId ?? 'anonymous', ...key.slice(2)]
    : ['private', userId ?? 'anonymous', ...key];
}
