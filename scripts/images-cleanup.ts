import { config as loadDotenv } from 'dotenv';
import { cleanupImages } from '../apps/api/src/modules/images/images.service.js';
import { closePool } from '../apps/api/src/db/pool.js';
loadDotenv();
cleanupImages()
  .then((count) => console.log(`Cleaned ${count} tracked image uploads.`))
  .catch(() => {
    console.error(
      'Image cleanup failed. Tracked records are retained for retry.',
    );
    process.exitCode = 1;
  })
  .finally(closePool);
