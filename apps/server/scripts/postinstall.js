#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ~/.ji 데이터 디렉토리 생성
const dataDir = path.join(os.homedir(), '.ji');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`[ji] Created data directory: ${dataDir}`);
}

// better-sqlite3 네이티브 모듈 확인 및 빌드
function isSqliteLoadable() {
  try {
    require('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

if (!isSqliteLoadable()) {
  console.log('[ji] Building better-sqlite3 for your platform...');

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['rebuild', 'better-sqlite3'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    shell: false,
  });

  if (result.status !== 0) {
    console.error(
      '\n[ji] ⚠️  better-sqlite3 build failed.\n' +
        '  SQLite requires native build tools (node-gyp).\n' +
        '  Install them and retry:\n\n' +
        '    Windows : npm install --global windows-build-tools\n' +
        '    macOS   : xcode-select --install\n' +
        '    Linux   : sudo apt-get install build-essential python3\n\n' +
        '  Then run: npm rebuild better-sqlite3\n' +
        '  See: https://github.com/nodejs/node-gyp#installation\n',
    );
    // 빌드 실패해도 설치 자체는 중단하지 않음 (경고만 출력)
  } else {
    console.log('[ji] better-sqlite3 built successfully.');
  }
} else {
  console.log('[ji] better-sqlite3 is ready.');
}
