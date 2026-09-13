/** Provider ports keep domain/application code independent from concrete PSP,
 * S3 and notification vendors. Existing provider implementations can be
 * adapted without changing the use-case layer. */
export const ProviderPortNames = Object.freeze({
  payments: 'PaymentProviderPort',
  storage: 'StorageProviderPort',
  notifications: 'NotificationProviderPort',
});

export function assertProviderPort(port, name) {
  if (!port || typeof port !== 'object') throw new TypeError(`${name} provider port is required`);
  return port;
}
