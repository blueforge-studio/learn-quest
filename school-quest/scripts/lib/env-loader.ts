/**
 * Load .env from scripts directory.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export function loadEnv(scriptPath: string): void {
  const scriptsDir = dirname(scriptPath);
  const envPath = join(scriptsDir, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const match = line.match(/^([^#=]+)=(.+)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  }
}
