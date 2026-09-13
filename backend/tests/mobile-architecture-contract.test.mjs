import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

const authPages = read('lib/features/auth/login_page.dart') + read('lib/features/auth/register_page.dart') + read('lib/features/auth/password_reset_page.dart');
const authRepo = read('lib/core/auth/auth_repository.dart');
const authController = read('lib/core/auth/auth_controller.dart');
const profilePage = read('lib/features/profile/profile_page.dart');
const profileRepo = read('lib/core/profile/profile_repository.dart');
const profileController = read('lib/features/profile/profile_controller.dart');
const detailController = read('lib/features/marketplace/job_detail_controller.dart');
const notificationsPage = read('lib/features/notifications/notifications_page.dart');
const notificationsRepo = read('lib/core/notifications/notification_repository.dart');
const main = read('lib/main.dart');

test('auth UI depends on AuthController/Repository, not ApiClient', () => {
  assert.match(authPages, /AuthController/);
  assert.match(authPages, /AuthController/);
  assert.doesNotMatch(authPages, /ApiClient/);
  assert.match(authController, /AuthRepository/);
  assert.match(authRepo, /abstract interface class AuthRepository/);
});

test('profile UI is typed and repository-backed', () => {
  assert.match(profilePage, /ProfileRepository/);
  assert.match(profilePage, /Future<HopeProviderProfile>/);
  assert.match(profilePage, /Future<List<HopeApplication>>/);
  assert.doesNotMatch(profilePage, /ApiClient/);
  assert.match(profileRepo, /class HopeProviderProfile/);
});

test('feature pages delegate data actions to feature controllers', () => {
  assert.match(profilePage, /ProfileController/);
  assert.match(profileController, /Future<HopeProviderProfile>/);
  assert.match(profileController, /withdrawApplication/);
  const detailPage = read('lib/features/marketplace/job_detail_page.dart');
  assert.match(detailPage, /JobDetailController/);
  assert.match(detailController, /candidateAction/);
  assert.match(detailController, /SubmitOfferUseCase|_offerUseCase/);
  assert.doesNotMatch(detailPage, /context\.read<JobDetailRepository>\(\)\.submitOffer/);
});

test('notifications UI is typed and repository-backed', () => {
  assert.match(notificationsPage, /HopeNotificationPage|NotificationRepository|ApplicationRegistry/);
  assert.doesNotMatch(notificationsPage, /ApiClient/);
  assert.match(notificationsRepo, /abstract interface class NotificationRepository/);
});

test('composition root owns concrete infrastructure', () => {
  for (const token of ['ApiAuthRepository(api)', 'ApiProfileRepository(api)', 'ApiNotificationRepository(api)', 'Provider<AuthRepository>', 'Provider<ProfileRepository>', 'Provider<NotificationRepository>']) {
    assert.match(main, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), token);
  }
});
