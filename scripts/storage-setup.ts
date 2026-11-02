import { config as loadDotenv } from 'dotenv';
import { SETTINGS_IMAGE_MB_LIMIT } from '@workshop/shared';
import {
  imageStorageConfig,
  storageRequest,
} from '../apps/api/src/modules/images/image-storage.js';
loadDotenv();
async function main() {
  const config = imageStorageConfig();
  const settings = {
    id: config.STUDIO_IMAGE_BUCKET,
    name: config.STUDIO_IMAGE_BUCKET,
    public: true,
    file_size_limit: SETTINGS_IMAGE_MB_LIMIT * 1024 * 1024,
    allowed_mime_types: ['image/webp'],
  };
  const bucketList = await storageRequest('bucket');
  if (!bucketList.ok) throw new Error('Cannot inspect storage bucket.');
  const buckets: unknown = await bucketList.json();
  if (!Array.isArray(buckets))
    throw new Error('Invalid storage bucket response.');
  const exists = buckets.some(
    (bucket) => bucket?.id === config.STUDIO_IMAGE_BUCKET,
  );
  const response = await storageRequest(
    exists ? `bucket/${config.STUDIO_IMAGE_BUCKET}` : 'bucket',
    {
      method: exists ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    },
  );
  if (!response.ok) throw new Error('Cannot configure storage bucket.');
  console.log(
    `studio-images: public read, WebP only, infrastructure cap ${SETTINGS_IMAGE_MB_LIMIT} MB; application settings enforce the current upload limit. No anonymous write policies were created.`,
  );
}
main().catch(() => {
  console.error(
    'Storage setup failed. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then retry.',
  );
  process.exitCode = 1;
});
