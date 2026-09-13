import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);

const readVersion = () => {
  const pubspec = fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8');
  const match = pubspec.match(/^version:\s*([^\r\n]+)/m);
  assert.ok(match, 'pubspec.yaml must declare version');
  const [name, code] = match[1].trim().split('+', 2);
  assert.ok(name && /^\d+$/.test(code || ''), 'pubspec version must be <name>+<code>');
  return { raw: match[1].trim(), name, code: Number(code) };
};

test('all release/version surfaces consume the pubspec version contract', () => {
  const app = readVersion();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'backend/package-lock.json'), 'utf8'));
  const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle.kts'), 'utf8');
  const build = fs.readFileSync(path.join(root, 'tools/build_apk_release.sh'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'backend/src/config.js'), 'utf8');
  assert.equal(pkg.version, app.name);
  assert.equal(lock.packages[''].version, app.name);
  assert.match(gradle, /versionCode = appVersionCode/);
  assert.match(gradle, /versionName = appVersionName/);
  assert.doesNotMatch(gradle, /versionName = "\d+\.\d+\.\d+"/);
  assert.doesNotMatch(gradle, /versionCode = \d+/);
  assert.match(build, /APP_VERSION=/);
  assert.match(config, /pubspecText/);
});
