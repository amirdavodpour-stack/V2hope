// Repository facade: keep public imports stable while each bounded context owns its persistence code.
export * from './repository/core.js';
export * from './repository/auth.js';
export * from './repository/storage.js';
export * from './repository/payments.js';
export * from './repository/outbox.js';
export * from './repository/views.js';
export * from './repository/notifications.js';
export * from './repository/analytics.js';
export * from './repository/admin.js';
export * from './repository/applications.js';
export * from './repository/trust.js';
export * from './repository/privacy.js';

export * from './repository/saved_searches.js';
