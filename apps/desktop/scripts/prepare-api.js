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
  const rootDir = path.join(__dirname, '..', '..', '..');
  const apiDir = path.join(rootDir, 'apps', 'api');
  const destApiDir = path.join(__dirname, '..', 'resources', 'api');

  console.log('[prepare-api] Compiling NestJS API for desktop...');
  execSync('npm run build', {
    cwd: apiDir,
    stdio: 'inherit',
  });

  const apiDist = path.join(apiDir, 'dist');
  const apiPrisma = path.join(apiDir, 'prisma');

  const destDist = path.join(destApiDir, 'dist');
  const destPrisma = path.join(destApiDir, 'prisma');
  const destNodeModules = path.join(destApiDir, 'node_modules');

  console.log(`[prepare-api] Copying API dist and Prisma to ${destApiDir}...`);
  if (fs.existsSync(destDist)) fs.rmSync(destDist, { recursive: true, force: true });
  if (fs.existsSync(destPrisma)) fs.rmSync(destPrisma, { recursive: true, force: true });

  copyRecursiveSync(apiDist, destDist);
  copyRecursiveSync(apiPrisma, destPrisma);

  // Copy root or api production node_modules
  const rootNodeModules = path.join(rootDir, 'node_modules');
  console.log('[prepare-api] Bundling runtime node_modules dependencies...');

  const requiredModules = [
    '@nestjs',
    '@prisma',
    '.prisma',
    'accepts',
    'append-field',
    'array-flatten',
    'bcryptjs',
    'body-parser',
    'buffer-from',
    'busboy',
    'bytes',
    'call-bind-apply-helpers',
    'call-bound',
    'class-transformer',
    'class-validator',
    'concat-stream',
    'content-disposition',
    'content-type',
    'cookie',
    'cookie-parser',
    'cookie-signature',
    'cors',
    'debug',
    'depd',
    'destroy',
    'dotenv',
    'dotenv-expand',
    'dunder-proto',
    'ecdsa-sig-formatter',
    'ee-first',
    'encodeurl',
    'es-define-property',
    'es-errors',
    'es-object-atoms',
    'escape-html',
    'etag',
    'express',
    'fast-safe-stringify',
    'finalhandler',
    'forwarded',
    'fresh',
    'function-bind',
    'get-intrinsic',
    'get-proto',
    'gopd',
    'has-symbols',
    'hasown',
    'http-errors',
    'iconv-lite',
    'inherits',
    'ipaddr.js',
    'iterare',
    'js-yaml',
    'jsonwebtoken',
    'jwa',
    'jws',
    'libphonenumber-js',
    'lodash',
    'lodash.includes',
    'lodash.isboolean',
    'lodash.isinteger',
    'lodash.isnumber',
    'lodash.isplainobject',
    'lodash.isstring',
    'lodash.once',
    'math-intrinsics',
    'media-typer',
    'merge-descriptors',
    'methods',
    'mime',
    'mime-db',
    'mime-types',
    'mkdirp',
    'ms',
    'multer',
    'negotiator',
    'object-assign',
    'object-inspect',
    'on-finished',
    'parseurl',
    'passport',
    'passport-jwt',
    'passport-strategy',
    'path-to-regexp',
    'pause',
    'pg',
    'pg-connection-string',
    'pg-pool',
    'pg-protocol',
    'pg-types',
    'pgpass',
    'postgres-array',
    'postgres-bytea',
    'postgres-date',
    'postgres-interval',
    'proxy-addr',
    'qs',
    'range-parser',
    'raw-body',
    'readable-stream',
    'reflect-metadata',
    'rxjs',
    'safe-buffer',
    'safer-buffer',
    'semver',
    'send',
    'serve-static',
    'setprototypeof',
    'side-channel',
    'side-channel-list',
    'side-channel-map',
    'side-channel-weakmap',
    'source-map-support',
    'statuses',
    'streamsearch',
    'swagger-ui-dist',
    'toidentifier',
    'tslib',
    'type-is',
    'uid',
    'uid-safe',
    'unpipe',
    'util-deprecate',
    'utils-merge',
    'uuid',
    'validator',
    'vary',
    'xtend',
  ];

  if (!fs.existsSync(destNodeModules)) {
    fs.mkdirSync(destNodeModules, { recursive: true });
  }

  for (const mod of requiredModules) {
    const srcMod = path.join(rootNodeModules, mod);
    const destMod = path.join(destNodeModules, mod);
    if (fs.existsSync(srcMod)) {
      copyRecursiveSync(srcMod, destMod);
    }
  }

  // Explicitly bundle @business-suite/shared only (avoids recursive desktop/web copies)
  const sharedSrc = path.join(rootDir, 'packages', 'shared');
  const sharedDest = path.join(destNodeModules, '@business-suite', 'shared');
  if (fs.existsSync(sharedDest)) fs.rmSync(sharedDest, { recursive: true, force: true });
  fs.mkdirSync(sharedDest, { recursive: true });
  copyRecursiveSync(path.join(sharedSrc, 'dist'), path.join(sharedDest, 'dist'));
  fs.copyFileSync(path.join(sharedSrc, 'package.json'), path.join(sharedDest, 'package.json'));

  console.log('[prepare-api] NestJS API runtime packaged successfully.');
}

main();
