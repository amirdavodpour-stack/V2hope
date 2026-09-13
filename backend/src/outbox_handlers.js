import { config } from './config.js';
import { claimOutboxEvent, completePaymentCreateHoldOutbox, completePaymentReleaseOutbox, completePaymentRefundOutbox, failOutboxEvent, listNotificationDevices, getUserEmail } from './repository.js';
import { paymentProvider } from './payment_provider.js';
import { deliverNotification } from './notification_provider.js';
import { logEvent, recordOutboxFailed, recordOutboxProcessed, recordCategoryFailure } from './observability.js';

function failureCategory(event) {
  const type = event?.event_type || '';
  if (type.startsWith('PAYMENT_')) return 'payment';
  if (type === 'NOTIFICATION_DISPATCH') {
    const channel = event?.payload?.channel;
    if (channel === 'PUSH') return 'push';
    if (channel === 'EMAIL') return 'email';
  }
  return null;
}

export async function processOutboxEvent(event) {
  try {
    const payload = event.payload || {};
    if (event.event_type === 'PAYMENT_CREATE_HOLD') {
      const result = await paymentProvider.createHold({ paymentId: payload.paymentId, amount: payload.amount, currency: payload.currency, idempotencyKey: payload.idempotencyKey });
      if (result.status !== 'HELD' || !result.providerRef) throw new Error('PAYMENT_PROVIDER_UNCONFIRMED');
      const completed = await completePaymentCreateHoldOutbox({ eventId:event.id, jobId:payload.jobId, paymentId:payload.paymentId, providerRef:result.providerRef, actorId:payload.ownerId, leaseToken:event.lease_token });
      if (!completed?.completed) throw new Error(`OUTBOX_CREATE_HOLD_COMMIT_FAILED:${completed?.reason || 'UNKNOWN'}`);
      recordOutboxProcessed();
      logEvent({ level:'info', action:'OUTBOX_PROCESSED', eventId:event.id, eventType:event.event_type });
    } else if (event.event_type === 'PAYMENT_REFUND') {
      const result = await paymentProvider.refundHold({ paymentId: payload.paymentId, providerRef: payload.providerRef, idempotencyKey: payload.idempotencyKey || `refund:${payload.refundId}` });
      if (result.status !== 'REFUNDED' || !result.refundRef) throw new Error('PAYMENT_PROVIDER_REFUND_UNCONFIRMED');
      const completed = await completePaymentRefundOutbox({ eventId:event.id, jobId:payload.jobId, paymentId:payload.paymentId, refundId:payload.refundId, providerRef:result.refundRef, actorId:payload.ownerId, leaseToken:event.lease_token });
      if (!completed?.completed) throw new Error(`OUTBOX_REFUND_COMMIT_FAILED:${completed?.reason || 'UNKNOWN'}`);
      recordOutboxProcessed();
      logEvent({ level:'info', action:'OUTBOX_PROCESSED', eventId:event.id, eventType:event.event_type });
    } else if (event.event_type === 'PAYMENT_RELEASE') {
      const result = await paymentProvider.releaseHold({ paymentId: payload.paymentId, providerRef: payload.providerRef, idempotencyKey: payload.idempotencyKey || `payment-release:${payload.paymentId}` });
      if (result.status !== 'RELEASED') throw new Error('PAYMENT_PROVIDER_UNCONFIRMED');
      const completed = await completePaymentReleaseOutbox({ eventId:event.id, jobId:payload.jobId, paymentId:payload.paymentId, actorId:payload.ownerId, leaseToken:event.lease_token });
      if (!completed?.completed) throw new Error(`OUTBOX_RELEASE_COMMIT_FAILED:${completed?.reason || 'UNKNOWN'}`);
      recordOutboxProcessed();
      logEvent({ level:'info', action:'OUTBOX_PROCESSED', eventId:event.id, eventType:event.event_type });
    } else if (event.event_type === 'NOTIFICATION_DISPATCH') {
      const channel = payload.channel;
      if (channel === 'IN_APP') {
        recordOutboxProcessed();
        logEvent({ level:'info', action:'NOTIFICATION_DELIVERED', eventId:event.id, notificationId:payload.notificationId, channel });
      } else {
        const url = channel === 'PUSH' ? config.notificationPushUrl : channel === 'EMAIL' ? config.notificationEmailUrl : '';
        if (!url) {
          recordOutboxProcessed();
          logEvent({ level:'info', action:'NOTIFICATION_PROVIDER_NOT_CONFIGURED', eventId:event.id, notificationId:payload.notificationId, channel });
        } else {
          const targets = channel === 'PUSH' ? await listNotificationDevices(payload.userId) : [{ email: await getUserEmail(payload.userId) }];
          if (!targets.length || (channel === 'EMAIL' && !targets[0].email)) {
            recordOutboxProcessed();
            logEvent({ level:'info', action:'NOTIFICATION_NO_TARGET', eventId:event.id, notificationId:payload.notificationId, channel });
          } else {
            for (const target of targets) {
              const body = channel === 'PUSH'
                ? { notificationId:payload.notificationId, userId:payload.userId, token:target.token, platform:target.platform, title:payload.title, body:payload.body, data:payload.data || {} }
                : { notificationId:payload.notificationId, userId:payload.userId, to:target.email, subject:payload.title, text:payload.body, data:payload.data || {} };
              await deliverNotification({
                url,
                payload: body,
                idempotencyKey: `notification:${payload.notificationId}:${channel}:${target.token || target.email}`,
              });
            }
            recordOutboxProcessed();
            logEvent({ level:'info', action:'NOTIFICATION_DELIVERED', eventId:event.id, notificationId:payload.notificationId, channel, targetCount:targets.length });
          }
        }
      }
    } else {
      throw new Error(`UNSUPPORTED_OUTBOX_EVENT:${event.event_type}`);
    }
    return { processed:true };
  } catch (error) {
    recordOutboxFailed();
    const category = failureCategory(event);
    if (category) recordCategoryFailure(category);
    logEvent({ level:'warn', action:'OUTBOX_FAILED', eventId:event.id, eventType:event.event_type, error:error?.message || String(error) });
    return failOutboxEvent({ eventId:event.id, error:error?.message || error, maxAttempts:config.outboxMaxAttempts, leaseToken:event.lease_token });
  }
}
