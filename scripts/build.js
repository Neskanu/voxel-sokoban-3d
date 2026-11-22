'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const WEB_DIR = path.join(DIST_DIR, 'web');
const ZIP_PATH = path.join(DIST_DIR, 'voxel-sokoban-3d-crazygames.zip');

const CRAZYGAMES_INITIAL_LIMIT_BYTES = 50 * 1024 * 1024;
const CRAZYGAMES_TOTAL_LIMIT_BYTES = 250 * 1024 * 1024;

function walkFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  // 1. Verify JS syntax across all modules
  const jsFiles = walkFiles(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  for (const file of jsFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
  console.log(`Syntax check passed for ${jsFiles.length} JS files.`);

  // 2. Clean and populate dist/web
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(WEB_DIR, { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(WEB_DIR, 'index.html'));
  copyTree(path.join(ROOT, 'css'), path.join(WEB_DIR, 'css'));
  copyTree(path.join(ROOT, 'js'), path.join(WEB_DIR, 'js'));

  // 3. Create zip package for CrazyGames upload
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Compress-Archive -Path '${WEB_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force`
      ],
      { stdio: 'pipe' }
    );
  } else {
    execFileSync('zip', ['-rq', ZIP_PATH, '.'], { cwd: WEB_DIR, stdio: 'pipe' });
  }

  // 4. Measure bundle sizes (all dist/web files are initial-load static assets)
  const bundleFiles = walkFiles(WEB_DIR);
  let totalBytes = 0;
  console.log('\nProduction bundle contents:');
  bundleFiles.forEach((f) => {
    const size = fs.statSync(f).size;
    totalBytes += size;
    const rel = path.relative(WEB_DIR, f).replace(/\\/g, '/');
    console.log(`  ${rel.padEnd(36)} ${formatSize(size).padStart(10)}`);
  });

  const zipBytes = fs.statSync(ZIP_PATH).size;
  const initialBytes = totalBytes;

  console.log('\nCrazyGames Bundle Metrics:');
  console.log(`  Initial Load Size (local assets): ${formatSize(initialBytes)} (${initialBytes} B) / 50.00 MB limit`);
  console.log(`  Total Bundle Size (uncompressed): ${formatSize(totalBytes)} (${totalBytes} B) / 250.00 MB limit`);
  console.log(`  Upload ZIP Size:                  ${formatSize(zipBytes)} (${zipBytes} B)`);

  if (initialBytes > CRAZYGAMES_INITIAL_LIMIT_BYTES || totalBytes > CRAZYGAMES_TOTAL_LIMIT_BYTES) {
    console.error('ERROR: Bundle exceeds CrazyGames size limits.');
    process.exit(1);
  }
  console.log('PASS: Production bundle is well within CrazyGames limits.');
}

main();
