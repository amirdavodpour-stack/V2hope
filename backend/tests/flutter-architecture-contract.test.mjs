import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('marketplace list/create features depend on the repository boundary', () => {
  const jobs = read('lib/features/jobs/jobs_page.dart');
  const create = read('lib/features/marketplace/create_job_page.dart');
  const repository = read('lib/core/marketplace/marketplace_repository.dart');

  assert.match(jobs, /ApplicationRegistry/);
  assert.match(create, /ApplicationRegistry/);
  assert.match(repository, /abstract interface class MarketplaceRepository/);
  assert.doesNotMatch(jobs, /widget\.api/);
  assert.doesNotMatch(create, /widget\.api/);
  assert.doesNotMatch(jobs, /ApiClient/);
  assert.doesNotMatch(create, /ApiClient/);
});

test('marketplace repository owns HTTP paths for list/create/publish operations', () => {
  const repository = read('lib/core/marketplace/marketplace_repository.dart');

  for (const pathName of ['/categories', '/jobs/recommended', '/jobs', '/jobs/']) {
    assert.ok(repository.includes(pathName) || pathName === '/jobs/\u001b');
  }
  assert.match(repository, /createOpportunity/);
  assert.match(repository, /publishOpportunity/);
});


test('transactions list/detail use the transaction repository boundary', () => {
  const list = read('lib/features/transactions/transactions_page.dart');
  const detail = read('lib/features/transactions/transaction_page.dart');
  const repository = read('lib/core/transactions/transaction_repository.dart');
  const payment = read('lib/core/transactions/payment.dart');
  assert.match(list, /TransactionRepository/);
  assert.match(detail, /TransactionRepository/);
  assert.match(repository, /abstract interface class TransactionRepository/);
  assert.match(payment, /class HopePayment/);
  assert.doesNotMatch(list, /widget\.api\.request/);
  assert.doesNotMatch(detail, /widget\.api/);
  assert.match(detail, /required this.repository/);
  assert.match(detail, /required this.uploadQueue/);
  for (const method of ['getPayment', 'fundPayment', 'refundPayment', 'releasePayment', 'startJob', 'deliverJob', 'acceptJob', 'submitEvidence']) {
    assert.match(repository, new RegExp(method));
  }
});

test('feature logic is extracted from oversized Flutter pages', () => {
  const jobs = read('lib/features/jobs/jobs_page.dart');
  const jobLogic = read('lib/features/jobs/jobs_query_logic.dart');
  const create = read('lib/features/marketplace/create_job_page.dart');
  const payload = read('lib/features/marketplace/create_job_payload.dart');
  const transaction = read('lib/features/transactions/transaction_page.dart');
  const controller = read('lib/features/transactions/transaction_controller.dart');
  const home = read('lib/features/home/home_page.dart');
  assert.match(jobLogic, /normalizePersian/);
  assert.match(jobLogic, /filterJobs/);
  assert.doesNotMatch(jobs, /static String _normalizePersian/);
  assert.match(payload, /buildCreateOpportunityPayload/);
  assert.doesNotMatch(create, /double\.parse\(effectiveMin/);
  assert.match(controller, /class TransactionController/);
  assert.doesNotMatch(transaction, /switch \(operation\)/);
  assert.match(home, /part 'home_widgets\.part\.dart'/);
  assert.ok(jobs.split('\n').length < 400);
  assert.ok(create.split('\n').length < 450);
  assert.ok(transaction.split('\n').length < 300);
  assert.ok(home.split('\n').length < 260);
});


test('application registry centralizes cross-feature use cases without exposing ApiClient', () => {
  const registry = read('lib/core/application/application_registry.dart');
  const useCases = read('lib/core/application/use_cases.dart');
  const notifications = read('lib/features/notifications/notifications_page.dart');
  assert.match(registry, /NotificationRepository/);
  assert.match(registry, /ProfileRepository/);
  assert.match(registry, /AuthRepository/);
  assert.match(useCases, /ListNotificationsUseCase/);
  assert.match(useCases, /LoadProviderProfileUseCase/);
  assert.match(notifications, /ApplicationRegistry/);
  assert.doesNotMatch(notifications, /NotificationRepository/);
  assert.doesNotMatch(notifications, /ApiClient/);
});
