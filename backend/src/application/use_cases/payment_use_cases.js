import { requirePort } from '../ports/repositories.js';

/**
 * Application boundary for payment lifecycle orchestration. Route handlers may
 * pass adapters for file-mode development, while production injects the
 * PostgreSQL repository implementation. The important dependency direction is
 * application -> port, never application -> HTTP or SQL.
 */
export function createPaymentUseCases({ payments }) {
  const repository = requirePort(payments, 'payments repository');
  return Object.freeze({
    findByJob: (jobId) => repository.findPaymentByJob(jobId),
    adminFinancialSummary: () => repository.getAdminFinancialSummary(),
    fund: (input) => repository.fundJobAtomic(input),
    refund: (input) => repository.createRefundAtomic(input),
    release: (input) => repository.enqueuePaymentRelease(input),
    applyWebhook: (event) => repository.applyPaymentWebhookAtomic(event),
  });
}
