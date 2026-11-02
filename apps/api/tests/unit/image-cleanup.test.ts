import { beforeEach, describe, expect, it, vi } from 'vitest';
const repository = vi.hoisted(() => ({
  assertImageOwner: vi.fn(),
  reserveImage: vi.fn(),
  getOwnedImage: vi.fn(),
  confirmImage: vi.fn(),
  markImageDeleting: vi.fn(),
  markImageDeleted: vi.fn(),
  expiredImages: vi.fn(),
  purgeExpiredImage: vi.fn(),
  listStudioImages: vi.fn(),
}));
const remove = vi.hoisted(() => vi.fn());
vi.mock('../../src/modules/images/images.repository.js', () => repository);
vi.mock('../../src/modules/images/image-storage.js', () => ({
  createSignedUploadUrl: vi.fn(),
  imagePublicUrl: vi.fn(),
  inspectUploadedImage: vi.fn(),
  removeStorageImages: remove,
}));
import { AppError } from '../../src/errors/app-error.js';
import { cleanupImages } from '../../src/modules/images/images.service.js';
beforeEach(() => {
  vi.clearAllMocks();
  repository.markImageDeleting.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
});
describe('tracked image cleanup', () => {
  it('rechecks attachments before deleting a stale candidate', async () => {
    repository.expiredImages.mockResolvedValue([
      { id: 'now-attached', key: 'protected.webp', state: 'ready' },
    ]);
    repository.markImageDeleting.mockRejectedValueOnce(
      new AppError(409, 'CONFLICT', 'Attached after scan'),
    );
    expect(await cleanupImages()).toBe(0);
    expect(remove).not.toHaveBeenCalled();
    expect(repository.purgeExpiredImage).not.toHaveBeenCalled();
  });
  it('keeps the tracked record when storage deletion fails', async () => {
    repository.expiredImages.mockResolvedValue([
      { id: 'retry', key: 'retry.webp', state: 'deleting' },
    ]);
    remove.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(cleanupImages()).rejects.toThrow('Storage unavailable');
    expect(repository.purgeExpiredImage).not.toHaveBeenCalled();
  });
  it('re-deletes expired tombstones before physically removing records', async () => {
    repository.expiredImages.mockResolvedValue([
      { id: 'deleted', key: 'deleted.webp', state: 'deleted' },
    ]);
    expect(await cleanupImages()).toBe(1);
    expect(remove).toHaveBeenCalledWith(['deleted.webp']);
    expect(repository.purgeExpiredImage).toHaveBeenCalledWith('deleted');
  });
});
