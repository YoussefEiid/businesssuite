const fs = require('fs');
const path = require('path');

const srcAssets = path.join(__dirname, '..', 'src', 'assets');
const distAssets = path.join(__dirname, '..', 'dist', 'assets');

if (!fs.existsSync(distAssets)) {
  fs.mkdirSync(distAssets, { recursive: true });
}

if (fs.existsSync(srcAssets)) {
  const files = fs.readdirSync(srcAssets);
  for (const file of files) {
    fs.copyFileSync(path.join(srcAssets, file), path.join(distAssets, file));
  }
  console.log(`Copied ${files.length} assets to dist/assets`);
}
