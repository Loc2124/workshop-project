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
const storage = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(
    async (key: string) => `https://upload.example.test/${key}`,
  ),
  imagePublicUrl: vi.fn((key: string) => `https://cdn.example.test/${key}`),
  inspectUploadedImage: vi.fn(),
  removeStorageImages: vi.fn(),
}));
vi.mock('../../src/modules/images/images.repository.js', () => repository);
vi.mock('../../src/modules/images/image-storage.js', () => storage);
vi.mock('../../src/modules/settings/settings.repository.js', () => ({
  getSiteSettings: async () => ({ studio: { maxImageMb: 10 } }),
}));
import {
  deleteOwnedImage,
  finishImageUpload,
  requestImageUpload,
} from '../../src/modules/images/images.service.js';
const image = {
  id: 'image',
  key: 'profile.webp',
  byteSize: 100000,
  thumbnailKey: 'profile.thumb.webp',
  thumbnailByteSize: 12000,
  state: 'pending',
  expired: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  repository.getOwnedImage.mockResolvedValue(image);
  storage.inspectUploadedImage.mockResolvedValue(undefined);
});

describe('optional list thumbnails', () => {
  it('scopes both signed uploads to the owned studio and tracks both objects', async () => {
    const result = await requestImageUpload('owner', {
      studioId: 'studio',
      byteSize: 100000,
      thumbnailByteSize: 12000,
    });
    expect(repository.assertImageOwner).toHaveBeenCalledWith(
      'studio',
      'owner',
      undefined,
    );
    expect(result.thumbnailSignedUploadUrl).toContain('.thumb.webp');
    expect(repository.reserveImage.mock.calls[0].slice(6, 8)).toEqual([
      result.key.replace(/\.webp$/, '.thumb.webp'),
      12000,
    ]);
    expect(storage.createSignedUploadUrl).toHaveBeenCalledTimes(2);
  });
  it('validates the medium file before confirming and cleans up every variant', async () => {
    const record = {
      ...image,
      mediumKey: 'profile.medium.webp',
      mediumByteSize: 30000,
    };
    repository.getOwnedImage.mockResolvedValue(record);
    const result = await finishImageUpload('image', 'owner');
    expect(storage.inspectUploadedImage).toHaveBeenLastCalledWith(
      'profile.medium.webp',
      30000,
      undefined,
      614400,
    );
    expect(result.image).toHaveProperty(
      'mediumUrl',
      'https://cdn.example.test/profile.medium.webp',
    );
    await deleteOwnedImage('image', 'owner');
    expect(storage.removeStorageImages).toHaveBeenLastCalledWith([
      'profile.webp',
      'profile.thumb.webp',
      'profile.medium.webp',
    ]);
  });
  it('does not mark an image ready until the thumbnail is validated', async () => {
    storage.inspectUploadedImage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Incomplete thumbnail'));
    await expect(finishImageUpload('image', 'owner')).rejects.toThrow(
      'Incomplete thumbnail',
    );
    expect(repository.confirmImage).not.toHaveBeenCalled();
    expect(storage.inspectUploadedImage).toHaveBeenLastCalledWith(
      image.thumbnailKey,
      12000,
      undefined,
      204800,
    );
  });
  it('returns original and thumbnail URLs but keeps old uploads compatible', async () => {
    const result = await finishImageUpload('image', 'owner');
    expect(result.image).toEqual({
      id: 'image',
      key: 'profile.webp',
      url: 'https://cdn.example.test/profile.webp',
      thumbnailUrl: 'https://cdn.example.test/profile.thumb.webp',
    });
    repository.getOwnedImage.mockResolvedValue({
      ...image,
      thumbnailKey: null,
      thumbnailByteSize: null,
    });
    expect(
      (await finishImageUpload('image', 'owner')).image,
    ).not.toHaveProperty('thumbnailUrl');
  });
  it('removes both files when deleting an image', async () => {
    await deleteOwnedImage('image', 'owner');
    expect(storage.removeStorageImages).toHaveBeenCalledWith([
      'profile.webp',
      'profile.thumb.webp',
    ]);
    expect(repository.markImageDeleted).toHaveBeenCalledWith('image');
  });
});
