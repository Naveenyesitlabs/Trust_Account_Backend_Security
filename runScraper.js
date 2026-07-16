const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runScraper() {
  const scraperRoot = path.resolve(__dirname, 'wisefork-scraper-project');
  const scraperPath = path.join(
    __dirname,
    'wisefork-scraper-project',
    'run-scraper.js'
  );
  const resolvedScraperPath = path.resolve(scraperPath);

  if (!resolvedScraperPath.startsWith(scraperRoot + path.sep) || !fs.existsSync(resolvedScraperPath)) {
    console.error(`[SCRAPER] Invalid scraper path: ${resolvedScraperPath}`);
    return null;
  }

  // Read scraper's own .env directly
  const envFilePath = path.join(__dirname, 'wisefork-scraper-project', '.env');
  const envVars = {};

  if (fs.existsSync(envFilePath)) {
    console.log(`[SCRAPER] Loading .env from: ${envFilePath}`);
    const lines = fs.readFileSync(envFilePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
    console.log('[SCRAPER] Env keys loaded:', Object.keys(envVars).join(', '));
  } else {
    console.error(`[SCRAPER] ❌ .env not found at: ${envFilePath}`);
  }

  // nosemgrep
  const scraper = spawn(
    'node',
    [resolvedScraperPath],
    {
      cwd: scraperRoot,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        ...envVars
      }
    }
  );

  scraper.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.trim()) console.log(`[SCRAPER] ${line}`);
    });
  });

  scraper.stderr.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.trim()) console.error(`[SCRAPER ERROR] ${line}`);
    });
  });

  scraper.on('error', (err) => {
    console.error('[SCRAPER] Failed to start process:', err.message);
  });

  scraper.on('close', (code) => {
    if (code === 0) {
      console.log('[SCRAPER] ✅ Finished successfully');
    } else {
      console.error(`[SCRAPER] ❌ Exited with code ${code}`);
    }
  });

  return scraper;
}

module.exports = runScraper;
