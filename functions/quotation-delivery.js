'use strict';

const deliverQuotation = async ({ db, id, send, credentials, now = () => new Date().toISOString() }) => {
  const ref = db.collection('quotations').doc(id);
  const record = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      const error = new Error('Quotation not found.');
      error.status = 404;
      throw error;
    }
    const saved = snapshot.data();
    if (saved.status !== 'draft') {
      const error = new Error(`Quotation delivery status is ${saved.status}. Check the mailbox before creating another quotation; this quotation cannot be sent again.`);
      error.status = 409;
      throw error;
    }
    transaction.update(ref, { status: 'sending', deliveryStartedAt: now() });
    return saved;
  });
  try {
    await send(record, credentials);
  } catch (cause) {
    console.error('Quotation email delivery could not be confirmed:', cause);
    try {
      await ref.update({ status: 'delivery_unknown' });
    } catch (trackingError) {
      console.error('Could not update quotation delivery status:', trackingError);
    }
    const error = new Error('Quotation saved, but email delivery could not be confirmed. Check the sender mailbox before sending a new quotation.');
    error.status = 502;
    error.saved = true;
    throw error;
  }
  try {
    await ref.update({ status: 'sent', sentAt: now() });
  } catch (cause) {
    console.error('Quotation email sent but tracking update failed:', cause);
    const error = new Error('Quotation email was sent, but delivery tracking failed. Do not send it again; contact the administrator.');
    error.status = 502;
    error.saved = true;
    error.emailSent = true;
    throw error;
  }
  return { ok: true, status: 'sent' };
};

module.exports = { deliverQuotation };
