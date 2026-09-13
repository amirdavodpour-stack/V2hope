import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('V2 premium design system is present and wired into flagship surfaces', () => {
  const pubspec = read('pubspec.yaml');
  const theme = read('lib/core/theme/hope_v2_design.dart');
  const components = read('lib/core/ui/premium_components.dart');
  const home = read('lib/features/home/home_page.dart');
  const jobs = read('lib/features/jobs/jobs_page.dart');
  const homeFeed = read('lib/features/home/premium_home_feed.dart');
  const jobCard = read('lib/features/jobs/jobs_widgets.part.dart');
  const profile = read('lib/features/profile/profile_page.dart');
  const transactions = read('lib/features/transactions/transactions_page.dart');
  const paymentSummary = read('lib/core/ui/premium_payment_summary.dart');
  const transactionUseCases = read('lib/core/application/use_cases.dart');
  const notifications = read('lib/features/notifications/notifications_page.dart');
  const admin = read('lib/features/admin/admin_page.dart');
  const lifecycle = read('lib/core/ui/premium_lifecycle.dart');
  const application = read('lib/core/marketplace/application.dart');
  const detailRepo = read('lib/core/marketplace/job_detail_repository.dart');
  const spec = read('V2-DESIGN-SYSTEM-SPEC.md');
  const profileRepo = read('lib/core/profile/profile_repository.dart');
  const providerRoute = read('backend/src/routes/provider_routes.js');
  const trustRepo = read('backend/src/repository/trust.js');

  assert.match(pubspec, /^version:\s*[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/m);
  for (const token of [
    'HopeV2Spacing', 'HopeV2Radii', 'HopeV2Breakpoints', 'HopeV2Surfaces',
    'HopeV2Shadows', 'HopeV2Type', 'HopeV2Motion', 'HopeV2Touch', 'HopeV2Layer',
  ]) assert.match(theme, new RegExp(`class ${token}`));
  for (const primitive of [
    'PremiumPageFrame', 'PremiumHeader', 'PremiumPanel', 'PremiumHero',
    'PremiumStatCard', 'PremiumSectionHeader', 'PremiumTag', 'PremiumSearchBar',
  ]) assert.match(components, new RegExp(`class ${primitive}`));
  assert.match(components, /MediaQuery\.sizeOf\(context\)\.width < HopeV2Breakpoints\.compact/);
  assert.match(components, /HopeV2Touch\.minimum/);
  assert.match(components, /MediaQuery\.paddingOf\(context\)/);
  assert.match(components, /Semantics\(/);
  assert.match(home, /PremiumHomeFeed/);
  assert.match(homeFeed, /PremiumHero/);
  assert.match(homeFeed, /PremiumStatCard/);
  assert.match(jobs, /premium_components\.dart/);
  assert.match(jobCard, /PremiumTag/);
  assert.match(jobCard, /HopeV2Radii/);
  assert.match(jobCard, /HopeV2Surfaces/);
  for (const migrated of [profile, transactions, notifications, admin]) {
    assert.match(migrated, /premium_components\.dart/);
    assert.match(migrated, /PremiumPageFrame|PremiumHeader|PremiumPanel/);
  }
  assert.match(lifecycle, /class PremiumLifecycle/);
  assert.match(lifecycle, /PremiumLifecycleStep/);
  assert.match(transactions, /PremiumLifecycle/);
  assert.match(transactions, /PremiumPaymentSummary/);
  assert.match(paymentSummary, /class PremiumPaymentSummary/);
  assert.match(transactionUseCases, /idempotencyKey/);
  assert.match(application, /class HopeOffer/);
  assert.match(application, /String get statusLabel/);
  assert.match(application, /bool get isTerminal/);
  assert.match(detailRepo, /Future<HopeOffer> submitOffer/);
  assert.match(spec, /Premium Max/);
  assert.match(spec, /accessibility/i);
  assert.match(profileRepo, /trustSignals/);
  assert.match(profileRepo, /completedJobs/);
  assert.match(providerRoute, /getPublicTrustSignals/);
  assert.match(providerRoute, /trustSignals/);
  assert.match(trustRepo, /getPublicTrustSignals/);
  assert.match(trustRepo, /completed_jobs/);

});
