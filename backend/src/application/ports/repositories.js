/**
 * Lightweight application ports. Concrete repository modules implement these
 * contracts; application services should depend on the capability they need,
 * not on the persistence technology.
 */
export const RepositoryPortNames = Object.freeze({
  jobs: 'JobRepository',
  applications: 'ApplicationRepository',
  payments: 'PaymentRepository',
  notifications: 'NotificationRepository',
  users: 'UserRepository',
  storage: 'StorageRepository',
});

export function requirePort(port, name) {
  if (!port) throw new TypeError(`${name} port is required`);
  return port;
}
