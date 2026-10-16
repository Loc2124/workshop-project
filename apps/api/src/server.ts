import { app } from './app.js';
import { loadConfig } from './config.js';

const { API_PORT: port } = loadConfig();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
