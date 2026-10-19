import { createApp } from './app.js';
import { loadConfig } from './config.js';

const { API_PORT: port, TRUST_PROXY_HOPS: trustProxyHops } = loadConfig();
const app = createApp();

if (trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
