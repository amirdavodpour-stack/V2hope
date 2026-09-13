import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepositoryPorts } from '../src/application/ports/repository_ports.js';

test('repository ports expose only capability-specific operations', () => {
  const repo = Object.fromEntries([
    'listJobViews','insertJob','updateJobSimple','transitionJobWithPayment',
    'findJobApplication','insertJobApplication','transitionCandidateApplication',
    'findPaymentByJob','fundJobAtomic','createRefundAtomic','enqueuePaymentRelease','applyPaymentWebhookAtomic','getAdminFinancialSummary',
    'getAdminSummary','listAdminUsers','listAdminJobs','listAdminApplications','listAdminAudit','setUserStatus','moderateJob','deleteJob','listTrustReports','updateTrustReportStatus','transitionJobApplication','selectJobApplication',
    'listCategories',
  ].map((name) => [name, () => name]));
  const ports = createRepositoryPorts(repo);
  assert.deepEqual(Object.keys(ports.jobs).sort(), ['insertJob','listJobViews','transitionJobWithPayment','updateJobSimple'].sort());
  assert.deepEqual(Object.keys(ports.payments).sort(), ['applyPaymentWebhookAtomic','createRefundAtomic','enqueuePaymentRelease','findPaymentByJob','fundJobAtomic','getAdminFinancialSummary'].sort());
  assert.deepEqual(Object.keys(ports.applications).sort(), ['findJobApplication','insertJobApplication','transitionCandidateApplication'].sort());
  assert.equal(ports.jobs.listJobViews(), 'listJobViews');
  assert.equal(ports.payments.fundJobAtomic(), 'fundJobAtomic');
});
