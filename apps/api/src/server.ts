import { createApp } from './app.js';
import { loadConfig } from './config.js';

const { API_PORT: port } = loadConfig();
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
