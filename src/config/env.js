import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export function getEnv() {
    dotenv.config({ path: path.resolve(rootDir, '.env') });

    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT || 3000),
        syncDataDir: process.env.SYNC_DATA_DIR || 'data',
        hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
        googleCalendarCredentialsJson: process.env.GOOGLE_CALENDAR_CREDENTIALS_JSON || '',
        googleCalendarTokenJson: process.env.GOOGLE_CALENDAR_TOKEN_JSON || ''
    };
}

export function resolveDataDir() {
    const env = getEnv();
    return path.resolve(rootDir, env.syncDataDir);
}
