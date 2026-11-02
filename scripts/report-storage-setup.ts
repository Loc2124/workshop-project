import { config } from 'dotenv';
import { storageRequest } from '../apps/api/src/modules/images/image-storage.js';
config();
async function main() {
  const id = 'report-attachments';
  const list = await storageRequest('bucket');
  if (!list.ok) throw new Error('Bucket lookup failed');
  const buckets = await list.json();
  if (!Array.isArray(buckets)) throw new Error('Invalid bucket response');
  const exists = buckets.some((bucket) => bucket.id === id);
  const response = await storageRequest(exists ? `bucket/${id}` : 'bucket', {
    method: exists ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: id,
      public: false,
      file_size_limit: 1048576,
      allowed_mime_types: ['image/webp'],
    }),
  });
  if (!response.ok) throw new Error('Bucket setup failed');
  console.log(
    'report-attachments: private, WebP, maximum 1 MB. No anonymous read/write policies created.',
  );
}
main().catch(() => {
  console.error(
    'Cannot configure private report storage. Check Supabase credentials and bucket permissions.',
  );
  process.exitCode = 1;
});
