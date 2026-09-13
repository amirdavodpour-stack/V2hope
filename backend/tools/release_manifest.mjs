import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('backend/package.json'));
const pubspec = read('pubspec.yaml');
const gradle = read('android/app/build.gradle.kts');
const rootBuild = read('android/build.gradle.kts');
const settings = read('android/settings.gradle.kts');
const versionMatch = pubspec.match(/^version:\s*([^\r\n]+)/m);
const appVersion = versionMatch?.[1]?.trim() || null;
const [versionName, versionCode] = appVersion?.includes('+') ? appVersion.split('+', 2) : [appVersion, null];
const gitSha = process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'unknown';
const apk = process.env.APK_PATH || '';
const isProduction = process.env.BUILD_PROFILE === 'production';
const certificationStatus = process.env.STAGING_CERTIFICATION_STATUS || '';
const certificationRunId = process.env.STAGING_CERTIFICATION_RUN_ID || '';
const certificationSha = process.env.STAGING_CERTIFICATION_SHA || '';
const certificationAttempt = process.env.STAGING_CERTIFICATION_ATTEMPT || '';
const backendImageId = process.env.BACKEND_IMAGE_ID || '';
const backendImageRef = process.env.BACKEND_IMAGE_REF || '';


const flutterVersion = (() => {
  try { return execFileSync('flutter', ['--version', '--machine'], { cwd: root, encoding: 'utf8' }); }
  catch { return ''; }
})();
let flutterMachine = null;
try { flutterMachine = flutterVersion ? JSON.parse(flutterVersion) : null; } catch { flutterMachine = null; }
const gradleWrapper = path.join(root, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
const gradleWrapperText = fs.existsSync(gradleWrapper) ? fs.readFileSync(gradleWrapper, 'utf8') : '';

// Content-addressed dependency state: hashing these files (rather than just
// listing versions) lets a consumer of the manifest verify the exact locked
// dependency graph and SBOM that produced this build, not merely a version
// string that could drift from the actual lockfile contents.
const sha256File = (relativePath) => {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
};
const dependencyState = {
  pubspecLock: sha256File('pubspec.lock'),
  backendPackageLock: sha256File('backend/package-lock.json'),
  gradleWrapperProperties: sha256File('android/gradle/wrapper/gradle-wrapper.properties'),
};
const sbomDigest = sha256File('backend/sbom.json');
const gradleDistribution = gradleWrapperText.match(/distributionUrl=.*gradle-([0-9.]+)-/)?.[1] || null;
const agpVersion = rootBuild.match(/com\.android\.application[^\n]*version\s*=\s*"([^"]+)"/)?.[1] || null;
const kotlinVersion = rootBuild.match(/org\.jetbrains\.kotlin\.android[^\n]*version\s*=\s*"([^"]+)"/)?.[1] || null;
const ndkVersion = gradle.match(/ndkVersion\s*=\s*"([^"]+)"/)?.[1] || null;
const compileSdk = Number(gradle.match(/compileSdk\s*=\s*(\d+)/)?.[1] || 0) || null;
const targetSdk = Number(gradle.match(/targetSdk\s*=\s*(\d+)/)?.[1] || 0) || null;
const minSdk = Number(gradle.match(/minSdk\s*=\s*(\d+)/)?.[1] || 0) || null;
const applicationId = gradle.match(/applicationId\s*=\s*"([^"]+)"/)?.[1] || null;

if (!appVersion || !versionName || !versionCode) throw new Error('Release manifest requires pubspec version in name+code form.');
if (isProduction) {
  if (certificationStatus !== 'PASS') throw new Error('Production release manifest requires PASS staging certification.');
  if (!certificationRunId) throw new Error('Production release manifest requires staging certification run id.');
  if (!certificationSha) throw new Error('Production release manifest requires staging certification SHA.');
  if (certificationSha !== gitSha) throw new Error('Production release manifest certification SHA must match the release SHA.');
  if (!/^\d+$/.test(certificationAttempt)) throw new Error('Production release manifest requires a numeric staging certification attempt.');
  if (!dependencyState.pubspecLock) throw new Error('Production release manifest requires pubspec.lock to compute dependency provenance.');
  if (!dependencyState.backendPackageLock) throw new Error('Production release manifest requires backend/package-lock.json to compute dependency provenance.');
  if (!sbomDigest) throw new Error('Production release manifest requires backend/sbom.json to compute an SBOM digest.');
}

const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  gitSha,
  appVersion,
  backendVersion: packageJson.version || null,
  toolchain: {
    flutter: flutterMachine?.frameworkVersion || null,
    dart: flutterMachine?.dartSdkVersion || null,
    gradle: gradleDistribution,
    androidGradlePlugin: agpVersion,
    kotlin: kotlinVersion,
    compileSdk,
    targetSdk,
    minSdk,
    ndk: ndkVersion,
    java: process.env.JAVA_HOME || null,
  },
  android: {
    applicationId,
    versionName,
    versionCode: Number(versionCode),
  },
  apk: null,
  backendImage: backendImageId ? { id: backendImageId, ref: backendImageRef || null } : null,
  dependencyState,
  sbomDigest,
  certification: {
    externalChecksRequired: true,
    source: 'production-release workflow',
    stagingCertificationStatus: certificationStatus || null,
    stagingCertificationRunId: certificationRunId || null,
    stagingCertificationSha: certificationSha || null,
    stagingCertificationAttempt: certificationAttempt ? Number(certificationAttempt) : null,
  },
};

if (apk) {
  const apkPath = path.isAbsolute(apk) ? apk : path.resolve(root, apk);
  const buf = fs.readFileSync(apkPath);
  manifest.apk = {
    path: path.relative(root, apkPath),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
  };
}

const out = process.env.RELEASE_MANIFEST_PATH || path.join(root, 'release-manifest.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o644 });
console.log(`Release manifest written: ${out}`);
