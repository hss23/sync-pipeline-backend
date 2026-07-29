import { createApp } from './app.js';
import { getEnv } from './config/env.js';

export function startServer(port = getEnv().port) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Sync backend listening on port ${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
