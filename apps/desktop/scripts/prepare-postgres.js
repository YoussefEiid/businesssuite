const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

function findSourcePgDir() {
  const candidates = [
    process.env.PG_DIST_PATH,
    'C:\\Program Files\\PostgreSQL\\18',
    'C:\\Program Files\\PostgreSQL\\17',
    'C:\\Program Files\\PostgreSQL\\16',
    'C:\\Program Files\\PostgreSQL\\15',
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'bin', 'postgres.exe')) && fs.existsSync(path.join(c, 'bin', 'initdb.exe'))) {
      return c;
    }
  }
  return null;
}

function main() {
  const sourcePg = findSourcePgDir();
  if (!sourcePg) {
    console.warn('[prepare-postgres] Warning: No PostgreSQL source distribution found. Skipping bundling.');
    return;
  }

  const destPg = path.join(__dirname, '..', 'resources', 'postgres');
  console.log(`[prepare-postgres] Packaging PostgreSQL runtime from ${sourcePg} into ${destPg}...`);

  const destBin = path.join(destPg, 'bin');
  const destShare = path.join(destPg, 'share');
  const destLib = path.join(destPg, 'lib');

  // 1. Copy required EXEs and DLLs from bin
  const requiredExes = ['postgres.exe', 'initdb.exe', 'pg_ctl.exe', 'psql.exe', 'pg_dump.exe', 'pg_restore.exe', 'pg_isready.exe'];
  const srcBin = path.join(sourcePg, 'bin');

  if (fs.existsSync(srcBin)) {
    const files = fs.readdirSync(srcBin);
    for (const f of files) {
      if (f.endsWith('.dll') || requiredExes.includes(f)) {
        copyRecursiveSync(path.join(srcBin, f), path.join(destBin, f));
      }
    }
  }

  // 2. Copy share directory (timezones, bki, sql files, extension definitions)
  const srcShare = path.join(sourcePg, 'share');
  if (fs.existsSync(srcShare)) {
    const shareItems = fs.readdirSync(srcShare);
    for (const item of shareItems) {
      if (['timezone', 'timezonesets', 'extension'].includes(item) || item.endsWith('.sql') || item.endsWith('.bki') || item.endsWith('.txt') || item.endsWith('.sample')) {
        copyRecursiveSync(path.join(srcShare, item), path.join(destShare, item));
      }
    }
  }

  // 3. Copy runtime extension DLLs from lib
  const srcLib = path.join(sourcePg, 'lib');
  if (fs.existsSync(srcLib)) {
    const libFiles = fs.readdirSync(srcLib);
    for (const f of libFiles) {
      if (f.endsWith('.dll')) {
        copyRecursiveSync(path.join(srcLib, f), path.join(destLib, f));
      }
    }
  }

  console.log('[prepare-postgres] PostgreSQL portable runtime packaged successfully.');
}

main();
