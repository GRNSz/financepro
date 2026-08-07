const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();

const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const db = admin.firestore();

function toMillis(unixSeconds) {
  return unixSeconds ? unixSeconds * 1000 : null;
}

function inferPlan(metadata = {}, price = {}, product = {}) {
  const candidates = [
    metadata.plan,
    price.metadata?.plan,
    product.metadata?.plan,
    product.name
  ].filter(Boolean).map(value => String(value).toLowerCase());

  if (candidates.some(value => value.includes('pro'))) return 'pro';
  if (candidates.some(value => value.includes('plus'))) return 'plus';
  return null;
}

async function saveSubscription(uid, data) {
  if (!uid) return false;
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
  await db.collection('subscriptions').doc(uid).set({
    ...cleanData,
    uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return true;
}

async function findUidBySubscriptionId(subscriptionId) {
  if (!subscriptionId) return null;
  const snapshot = await db.collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

exports.stripeWebhook = onRequest({
  region: 'us-central1',
  secrets: [STRIPE_WEBHOOK_SECRET],
  cors: false
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Missing Stripe-Signature header');

  let event;
  try {
    // Firebase Functions keeps the original request bytes in rawBody.
    event = Stripe.webhooks.constructEvent(
      req.rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET.value()
    );
  } catch (error) {
    console.error('Stripe signature verification failed:', error.message);
    return res.status(400).send('Invalid webhook signature');
  }

  // Stripe may retry the same event. A transaction makes processing idempotent.
  const eventRef = db.collection('stripe_events').doc(event.id);
  const alreadyProcessed = await db.runTransaction(async transaction => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return true;
    transaction.create(eventRef, {
      type: event.type,
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return false;
  });
  if (alreadyProcessed) return res.status(200).json({ received: true, duplicate: true });

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const reference = session.client_reference_id || session.metadata?.uid || '';
      const [uid, planFromReference] = String(reference).split(':');
      const plan = inferPlan(session.metadata) || planFromReference;
      if (uid && plan) {
        let subscription = session.subscription;
        await saveSubscription(uid, {
          plan,
          status: subscription?.status || 'active',
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          stripeSubscriptionId: subscription?.id || session.subscription || null,
          currentPeriodEnd: toMillis(subscription?.current_period_end),
          cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
          source: 'stripe'
        });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const uid = await findUidBySubscriptionId(subscription.id);
      if (uid) {
        const isDeleted = event.type === 'customer.subscription.deleted';
        await saveSubscription(uid, {
          plan: isDeleted ? 'free' : undefined,
          status: isDeleted ? 'cancelled' : subscription.status,
          currentPeriodEnd: toMillis(subscription.current_period_end),
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null,
          stripeSubscriptionId: subscription.id,
          source: 'stripe'
        });
      }
    }
  } catch (error) {
    console.error('Stripe event processing failed:', error);
    return res.status(500).send('Webhook processing failed');
  }

  return res.status(200).json({ received: true });
});
