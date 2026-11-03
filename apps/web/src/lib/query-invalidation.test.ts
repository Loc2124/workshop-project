import { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { queryKeys } from './query-keys';
import { invalidateResources } from './query-invalidation';

it('invalidates affected lists/counts without discarding detail or another account data', async () => {
  const client = new QueryClient();
  const list = queryKeys.studios.list('a', { page: 1 });
  const counts = queryKeys.admin.counts('a', 'studios');
  const detail = queryKeys.studios.detail('a', 'one');
  const unrelated = queryKeys.users.list('a', {});
  const other = queryKeys.studios.list('b', { page: 1 });
  [list, counts, detail, unrelated, other].forEach((key) =>
    client.setQueryData(key, { value: 1 }),
  );
  await invalidateResources(client, 'a', ['studios']);
  expect(client.getQueryState(list)?.isInvalidated).toBe(true);
  expect(client.getQueryState(counts)?.isInvalidated).toBe(true);
  [detail, unrelated, other].forEach((key) =>
    expect(client.getQueryState(key)?.isInvalidated).toBe(false),
  );
  client.clear();
});
