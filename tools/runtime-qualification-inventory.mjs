#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repository from this script's location, not the caller's cwd.
// The documented command is run from backend/, so cwd must never change the
// project-root calculation.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function commandInfo(command) {
  try {
    const out = execFileSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' }).trim();
    return { present: Boolean(out), path: out || null };
  } catch {
    return { present: false, path: null };
  }
}

function envPresence(name) {
  return { present: Boolean(process.env[name]) };
}

function readMemMiB() {
  try {
    const text = fs.readFileSync('/proc/meminfo', 'utf8');
    const match = text.match(/^MemTotal:\s+(\d+)\s+kB$/m);
    return match ? Math.round(Number(match[1]) / 1024) : null;
  } catch {
    return null;
  }
}

function freeDiskMiB() {
  try {
    const out = execFileSync('df', ['-Pm', root], { encoding: 'utf8' }).trim().split('\n').pop();
    const parts = out.trim().split(/\s+/);
    return parts.length >= 4 ? Number(parts[3]) : null;
  } catch {
    return null;
  }
}

function javaMajor() {
  try {
    const result = execFileSync('java', ['-version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const text = `${result}`;
    const match = text.match(/version "(\d+)/);
    return match ? Number(match[1]) : null;
  } catch (error) {
    const text = `${error.stdout || ''}\n${error.stderr || ''}`;
    const match = text.match(/version "(\d+)/);
    return match ? Number(match[1]) : null;
  }
}

const inventory = {
  generated_at: new Date().toISOString(),
  project_root: root,
  host: {
    cpu_count: os.cpus().length,
    ram_mib: readMemMiB(),
    free_disk_mib: freeDiskMiB(),
    platform: process.platform,
    arch: process.arch,
  },
  commands: {
    node: commandInfo('node'),
    npm: commandInfo('npm'),
    java: commandInfo('java'),
    javac: commandInfo('javac'),
    flutter: commandInfo('flutter'),
    adb: commandInfo('adb'),
    docker: commandInfo('docker'),
    psql: commandInfo('psql'),
    pg_dump: commandInfo('pg_dump'),
    pg_restore: commandInfo('pg_restore'),
    sdkmanager: commandInfo('sdkmanager'),
    emulator: commandInfo('emulator'),
  },
  environment_presence: {
    ANDROID_HOME: envPresence('ANDROID_HOME'),
    ANDROID_SDK_ROOT: envPresence('ANDROID_SDK_ROOT'),
    S3_INTEGRATION: envPresence('S3_INTEGRATION'),
    S3_ENDPOINT: envPresence('S3_ENDPOINT'),
    S3_INTEGRATION_ENDPOINT: envPresence('S3_INTEGRATION_ENDPOINT'),
    STAGING_BASE_URL: envPresence('STAGING_BASE_URL'),
    NOTIFICATION_PROVIDER_TOKEN: envPresence('NOTIFICATION_PROVIDER_TOKEN'),
    NOTIFICATION_PUSH_URL: envPresence('NOTIFICATION_PUSH_URL'),
    NOTIFICATION_EMAIL_URL: envPresence('NOTIFICATION_EMAIL_URL'),
  },
  java_major: javaMajor(),
  project_paths: {
    android_gradlew: fs.existsSync(path.join(root, 'android', 'gradlew')),
    runtime_preflight: fs.existsSync(path.join(root, 'tools', 'runtime-certification-preflight.sh')),
    android_toolchain: fs.existsSync(path.join(root, 'tools', 'ci-android-toolchain.sh')),
    status_integrity: fs.existsSync(path.join(root, 'tools', 'validate-test-state.mjs')),
  },
};

if (process.env.QUALIFICATION_INVENTORY_OUTPUT) {
  fs.writeFileSync(process.env.QUALIFICATION_INVENTORY_OUTPUT, JSON.stringify(inventory, null, 2) + '\n');
}

console.log(JSON.stringify(inventory, null, 2));
