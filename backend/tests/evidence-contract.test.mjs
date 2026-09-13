import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { buildEvidence, describeArtifact, parseArgs } from '../tools/write-evidence.mjs';

const backendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const projectRoot = path.resolve(backendRoot, '..');
const evidenceDir = path.join(projectRoot, 'docs', 'audit', 'evidence');
const toolPath = path.join(backendRoot, 'tools', 'write-evidence.mjs');

const CI_ENV = {
  CI: 'true',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_REPOSITORY: 'hope/hope',
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '2',
  GITHUB_WORKFLOW: 'HOPE Build Test APK',
  RUNNER_OS: 'Linux',
  GITHUB_SHA: 'a'.repeat(40),
};

const runTool = (args, env) => {
  try {
    execFileSync(process.execPath, [toolPath, ...args], {
      cwd: backendRoot,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    return { code: 0 };
  } catch (err) {
    return { code: err.status, stderr: String(err.stderr ?? '') };
  }
};

test('evidence cannot be minted outside an automated run', () => {
  assert.throws(
    () => buildEvidence({ gate: 'npm_audit', command: 'x', result: 'pass', artifacts: [] }, { CI: 'false' }),
    /CI=true/,
  );
});

test('unknown gates are rejected', () => {
  assert.throws(
    () => buildEvidence({ gate: 'totally_fine', command: 'x', result: 'pass', artifacts: [] }, CI_ENV),
    /unknown gate/,
  );
});

test('a CI log URL is mandatory', () => {
  const env = { ...CI_ENV, GITHUB_RUN_ID: '' };
  assert.throws(
    () => buildEvidence({ gate: 'npm_audit', command: 'x', result: 'pass', artifacts: [] }, env),
    /log URL/,
  );
});

test('artifact size and checksum are measured, never taken on trust', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hope-ev-')), 'app.bin');
  fs.writeFileSync(file, 'hope');
  const described = describeArtifact(file);
  assert.equal(described.bytes, 4);
  assert.match(described.sha256, /^[0-9a-f]{64}$/);
  assert.throws(() => describeArtifact(`${file}.missing`));
});

test('declared artifacts that do not exist abort the write', () => {
  const result = runTool(
    ['--gate', 'android_build', '--command', 'flutter build apk --release', '--result', 'pass', '--artifact', '/nope/app-release.apk'],
    CI_ENV,
  );
  assert.notEqual(result.code, 0);
  assert.ok(!fs.existsSync(path.join(evidenceDir, 'android_build.json')));
});

test('argument parser rejects unknown flags', () => {
  assert.throws(() => parseArgs(['--gate', 'npm_audit', '--score', '100']), /unknown argument/);
});

test('every committed evidence artifact conforms to the required shape', () => {
  if (!fs.existsSync(evidenceDir)) return;
  const files = fs.readdirSync(evidenceDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const gate = file.replace(/\.json$/, '');
    const doc = JSON.parse(fs.readFileSync(path.join(evidenceDir, file), 'utf8'));
    assert.equal(doc.gate, gate, `${file}: gate name must match filename`);
    assert.ok(!Number.isNaN(Date.parse(doc.ranAt)), `${file}: ranAt must be an ISO timestamp`);
    assert.equal(typeof doc.command, 'string', `${file}: command required`);
    assert.ok(['pass', 'fail'].includes(doc.result), `${file}: result must be pass|fail`);
    assert.match(String(doc.logUrl), /^https:\/\/github\.com\/.+\/actions\/runs\/\d+/, `${file}: logUrl must point at a CI run`);
    assert.ok(Array.isArray(doc.artifacts), `${file}: artifacts must be an array`);
    for (const artifact of doc.artifacts) {
      assert.equal(typeof artifact.path, 'string');
      assert.ok(Number.isInteger(artifact.bytes) && artifact.bytes > 0, `${file}: artifact bytes must be positive`);
      assert.match(String(artifact.sha256), /^[0-9a-f]{64}$/, `${file}: artifact sha256 must be a digest`);
    }
  }
});

test('workflows emit evidence through the writer for the gates they run', () => {
  const workflowDir = path.join(projectRoot, '.github', 'workflows');
  const read = (name) => fs.readFileSync(path.join(workflowDir, name), 'utf8');
  const main = read('main.yml');
  const release = read('production-release.yml');
  assert.match(main, /write-evidence\.mjs[\s\S]*--gate npm_audit/);
  assert.match(main, /--gate flutter_toolchain/);
  assert.match(release, /--gate android_build/);

  const staging = read('staging-certification.yml');
  const dr = read('dr-restore.yml');
  const device = read('device-integration.yml');
  assert.match(staging, /--gate postgres_runtime/);
  assert.match(staging, /--gate s3_runtime/);
  assert.match(staging, /--gate provider_runtime/);
  assert.match(staging, /--gate perf_run/);
  assert.match(dr, /--gate dr_restore/);
  assert.match(device, /--gate device_certification/);
});

test('Evidence steps publish the observed outcome, never an unconditional pass', () => {
  // Flutter-toolchain and Android-build runtime gates
  // were converted to the same outcome-derived pattern, so no workflow may carry
  // a literal `--result pass` any more. Every gate result must come from the
  // observed step outcome.
  const workflowDir = path.join(projectRoot, '.github', 'workflows');
  for (const file of [
    'staging-certification.yml',
    'dr-restore.yml',
    'device-integration.yml',
    'main.yml',
    'production-release.yml',
  ]) {
    const body = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    assert.ok(
      !/--result\s+pass\b/.test(body),
      `${file}: evidence result must be derived from the observed run, not hardcoded to pass`,
    );
    assert.match(
      body,
      /GATE_RESULT: \$\{\{ steps\.[a-z_]+\.outcome == 'success' && 'pass' \|\| 'fail' \}\}/,
      `${file}: gate result must come from the observed step outcome`,
    );
  }
  const main = fs.readFileSync(path.join(workflowDir, 'main.yml'), 'utf8');
  assert.match(main, /--result "\$result"/, 'main.yml npm_audit gate must publish the observed exit status');
});

test('No workflow hardcodes a passing gate result', () => {
  const workflowDir = path.join(projectRoot, '.github', 'workflows');
  for (const file of fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'))) {
    const body = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    assert.ok(
      !/--result\s+pass\b/.test(body),
      `${file}: gate evidence must never be written with a literal --result pass`,
    );
  }
});

test('Runtime gates are outcome-derived and honest on failure', () => {
  const workflowDir = path.join(projectRoot, '.github', 'workflows');
  const main = fs.readFileSync(path.join(workflowDir, 'main.yml'), 'utf8');
  const release = fs.readFileSync(path.join(workflowDir, 'production-release.yml'), 'utf8');

  // the observed steps must be identifiable
  assert.match(main, /- name: Flutter static and test gate\n\s+id: flutter_gate/);
  assert.match(release, /- name: Build signed production APK\n\s+id: release_build/);
  assert.match(release, /- name: Verify signed production APK\n\s+id: apk_verify/);

  // the gate result must be derived from those steps
  assert.match(main, /GATE_RESULT: \$\{\{ steps\.flutter_gate\.outcome == 'success' && 'pass' \|\| 'fail' \}\}/);
  assert.match(release, /GATE_RESULT: \$\{\{ steps\.apk_verify\.outcome == 'success' && 'pass' \|\| 'fail' \}\}/);

  // and the converted evidence steps must still run when the observed command
  // failed. (main.yml's npm_audit gate is deliberately a single step that runs
  // the audit and records its observed exit status, so it needs no always().)
  const converted = [
    ['main.yml', main, '- name: Runtime gate - flutter toolchain'],
    ['production-release.yml', release, '- name: Runtime gate - android build'],
  ];
  for (const [file, body, header] of converted) {
    const parts = body.split(header);
    assert.equal(parts.length, 2, `${file}: expected exactly one ${header}`);
    assert.match(parts[1].slice(0, 400), /if:\s*\$\{\{\s*always\(\)/, `${file}: converted gate step must use always()`);
  }
});

test('evidence steps still run when the observed command fails', () => {
  const workflowDir = path.join(projectRoot, '.github', 'workflows');
  for (const file of ['staging-certification.yml', 'dr-restore.yml', 'device-integration.yml']) {
    const body = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    const gateSteps = body.split('- name: Runtime gate').slice(1);
    assert.ok(gateSteps.length > 0, `${file}: expected at least one runtime gate step`);
    for (const step of gateSteps) {
      const head = step.slice(0, 400);
      assert.match(head, /if:\s*\$\{\{\s*always\(\)/, `${file}: runtime gate steps must use always()`);
    }
  }
});

test('emulator scripts do not let tee mask a failing test run', () => {
  const workflowDir = path.join(projectRoot, '.github', 'workflows');
  for (const file of ['staging-certification.yml', 'device-integration.yml']) {
    const body = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    for (const line of body.split('\n')) {
      if (/flutter test .*\| tee /.test(line)) {
        assert.match(body, /set -[eo]{1,3}[a-z ]*pipefail/, `${file}: piping flutter test through tee requires pipefail`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// provider_runtime includes a notification-delivery leg. Before this leg the gate rested on payment
// provider only, while notification delivery was covered solely by a local
// 127.0.0.1 stub, so the gate could not honestly claim notification delivery.

const s19WorkflowDir = path.join(projectRoot, '.github', 'workflows');
const s19Staging = () => fs.readFileSync(path.join(s19WorkflowDir, 'staging-certification.yml'), 'utf8');

test('Staging certification runs the real notification delivery probe', () => {
  const staging = s19Staging();
  assert.match(staging, /id: notification_delivery/, 'the delivery step must exist and be addressable');
  assert.match(
    staging,
    /node \.\.\/tools\/staging-notification-delivery\.mjs/,
    'the delivery step must invoke the staging delivery script',
  );
  assert.ok(
    fs.existsSync(path.join(projectRoot, 'tools', 'staging-notification-delivery.mjs')),
    'the script the workflow invokes must exist in the repo',
  );
});

test('The notification delivery step is pipefail-guarded', () => {
  const staging = s19Staging();
  const step = staging.slice(
    staging.indexOf('id: notification_delivery'),
    staging.indexOf('- name: Runtime gate - provider runtime'),
  );
  assert.ok(step.length > 0, 'could not isolate the notification_delivery step');
  assert.match(step, /set -o pipefail/, 'a `| tee` step without pipefail hides a failing exit status');
  assert.match(step, /\| tee "\$RUNNER_TEMP\/staging-notification-delivery\.log"/);
});

test('The delivery step skips honestly when provider secrets are absent', () => {
  const staging = s19Staging();
  const ifLine = staging
    .split('\n')
    .find((l) => l.includes("env.NOTIFICATION_PROVIDER_TOKEN != ''"));
  assert.ok(ifLine, 'the delivery step must gate on NOTIFICATION_PROVIDER_TOKEN being present');
  assert.match(ifLine, /^\s*if:/, 'the secret presence test must live in the step `if`, so the step truly skips');
  assert.match(
    ifLine,
    /env\.NOTIFICATION_PUSH_URL != ''\s*\|\|\s*env\.NOTIFICATION_EMAIL_URL != ''/,
    'at least one of the push/email endpoints must be required',
  );
  // The secrets must be mapped to job env, because the `secrets` context is not
  // available inside a step-level `if`.
  for (const name of [
    'NOTIFICATION_PUSH_URL',
    'NOTIFICATION_EMAIL_URL',
    'NOTIFICATION_PROVIDER_TOKEN',
  ]) {
    assert.match(
      staging,
      new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`),
      `${name} must be wired from a repository secret`,
    );
  }
});

test('Provider runtime evidence is the AND of both legs and never a literal pass', () => {
  const staging = s19Staging();
  const start = staging.indexOf('- name: Runtime gate - provider runtime');
  assert.ok(start > 0, 'the provider_runtime evidence step must exist');
  const step = staging.slice(start, staging.indexOf('- name: Staging operational gate', start));
  assert.ok(step.length > 0, 'could not isolate the provider_runtime evidence step');

  // result is derived from BOTH step outcomes
  assert.match(step, /GATE_RESULT: \$\{\{ \(steps\.product_workflow\.outcome == 'success'/);
  assert.match(step, /steps\.notification_delivery\.outcome == 'success'\) && 'pass' \|\| 'fail'/);
  assert.match(step, /--result "\$GATE_RESULT"/, 'the writer must be given the derived result');

  // no hardcoded pass anywhere in the step
  assert.doesNotMatch(step, /--result pass/, 'the gate must never hardcode a passing result');
  assert.doesNotMatch(step, /--result 'pass'/);
  assert.doesNotMatch(step, /--result "pass"/);

  // if the delivery leg skipped, no evidence may be written at all
  assert.match(
    step,
    /steps\.notification_delivery\.conclusion != 'skipped'/,
    'a skipped delivery leg must prevent provider_runtime evidence from being written',
  );
  assert.match(step, /if: \$\{\{ always\(\)/, 'the evidence step must also run on failure');
});

test('The provider runtime note does not disclaim notification delivery', () => {
  const staging = s19Staging();
  assert.doesNotMatch(
    staging,
    /notification-provider delivery is NOT covered by this run/,
    'the outdated delivery disclaimer must be absent now that delivery is exercised',
  );
  assert.match(
    staging,
    /Final human receipt is attested by the provider, not by this run/,
    'the note must still state the limit of what the run proves',
  );
});

test('The delivery script skips rather than passes when unconfigured', () => {
  const script = fs.readFileSync(
    path.join(projectRoot, 'tools', 'staging-notification-delivery.mjs'),
    'utf8',
  );
  assert.match(script, /const EXIT_SKIP = 78;/, 'an unconfigured run must exit with a distinct skip code');
  assert.match(script, /process\.exit\(EXIT_SKIP\)/);
  // it must assert on real observations, not just log
  assert.match(script, /JOB_APPLICATION_RECEIVED/, 'it must observe a real notification record');
  assert.match(script, /x-metrics-token/, 'it must observe staging dispatch through /metrics');
  assert.match(script, /categoryFailures/, 'it must assert no push/email delivery failure');
});
