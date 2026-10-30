const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function main() {
  const webDir = path.join(__dirname, '..', '..', 'web');
  const webOutDir = path.join(webDir, 'out');
  const destWebDir = path.join(__dirname, '..', 'resources', 'web', 'out');

  console.log('[prepare-web] Building Next.js static export for desktop...');
  execSync('npm run build', {
    cwd: webDir,
    env: {
      ...process.env,
      NEXT_EXPORT: 'true',
    },
    stdio: 'inherit',
  });

  if (!fs.existsSync(webOutDir)) {
    throw new Error(`[prepare-web] Next.js export failed: ${webOutDir} does not exist`);
  }

  console.log(`[prepare-web] Copying static assets from ${webOutDir} to ${destWebDir}...`);
  if (fs.existsSync(destWebDir)) {
    fs.rmSync(destWebDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destWebDir, { recursive: true });
  copyRecursiveSync(webOutDir, destWebDir);

  console.log('[prepare-web] Desktop static Web UI assets packaged successfully.');
}

main();
