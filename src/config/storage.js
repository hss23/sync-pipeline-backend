import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir } from './env.js';

const dataDir = resolveDataDir();

export function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getDataFilePath(fileName) {
  return path.join(dataDir, fileName);
}
