import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { startAllJobs } from './jobs/index.js';

const {
  API_PORT: port,
  TRUST_PROXY_HOPS: trustProxyHops,
} = loadConfig();
const app = createApp();

if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

// Initialize background jobs (can be toggled if worker runs as separate process)
if (process.env.RUN_BACKGROUND_JOBS !== 'false') {
  startAllJobs();
}

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
