import { db } from '../db.js';
export async function applyLocalPaymentWebhookLegacy({ event, withTransaction, config, releaseJournal, payoutJournal, now }) {
  return withTransaction(async () => {
    const duplicate=db.collection.paymentWebhooks.find(x=>x.eventId===event.eventId); if(duplicate) return {processed:true,duplicate:true,paymentId:duplicate.paymentId};
    db.insert('paymentWebhooks',{id:db.id(),eventId:event.eventId,eventType:event.eventType,paymentId:event.paymentId,providerRef:event.providerRef,payload:event.payload,processedAt:now(),createdAt:now()});
    const payment=db.collection.payments.find(x=>x.id===event.paymentId); if(!payment) return {processed:true,duplicate:false,paymentId:null};
    if(event.eventType==='PAYMENT_HELD'&&payment.status==='HOLD_PENDING'){payment.status='HELD';if(event.providerRef)payment.providerRef=event.providerRef;db.touch('payments');}
    if(event.eventType==='PAYMENT_RELEASED'&&payment.status==='RELEASE_PENDING'){
      payment.status='RELEASED'; const job=db.collection.jobs.find(x=>x.id===payment.jobId); if(job){job.status='SETTLED';job.updatedAt=now();db.touch('jobs');}
      const b={baseAmount:payment.baseAmount||payment.amount,employerFee:payment.employerFee||0,workerFee:payment.workerFee||0,platformFee:payment.platformFee||0,employerCharge:payment.employerCharge||payment.amount,providerPayout:payment.providerPayout||payment.amount,currency:payment.currency||config.paymentCurrency};
      for(const journal of [releaseJournal(b),payoutJournal(b)]){const jid=db.id();for(const e of journal)db.insert('ledgerEntries',{id:db.id(),journalId:jid,referenceType:'PAYMENT_WEBHOOK',referenceId:payment.id,account:e.account,debit:e.debit,credit:e.credit,currency:b.currency,createdAt:now()});}
      db.insert('settlements',{id:db.id(),paymentId:payment.id,providerRef:event.providerRef||payment.providerRef,amount:b.providerPayout,currency:b.currency,status:'RELEASED',createdAt:now(),updatedAt:now()}); db.touch('payments','settlements');
    }
    if(event.eventType==='PAYMENT_REFUNDED'&&payment.status==='REFUND_PENDING'){payment.status='REFUNDED';db.touch('payments');}
    return {processed:true,duplicate:false,paymentId:payment.id};
  });
}
