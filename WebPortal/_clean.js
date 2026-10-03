import { rmSync, existsSync, mkdirSync } from 'fs';

const dirs = ['dist', 'dist-electron', 'release'];
for (const dir of dirs) {
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 2000 });
      console.log(`Removed ${dir}`);
    } catch (e) {
      console.error(`Failed to remove ${dir}: ${e.message}`);
    }
  }
}
mkdirSync('dist', { recursive: true });
console.log('dist recreated');