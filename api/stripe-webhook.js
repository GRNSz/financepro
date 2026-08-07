const Stripe = require('stripe');
const admin = require('firebase-admin');

// O Vercel precisa receber o corpo bruto para a validação da Stripe.
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function firebaseAdmin() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

function toMillis(unixSeconds) {
  return unixSeconds ? unixSeconds * 1000 : null;
}

async function saveSubscription(uid, data) {
  const db = admin.firestore();
  const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  await db.collection('subscriptions').doc(uid).set({
    ...cleanData,
    uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

module.exports = async function stripeWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const rawBody = await getRawBody(req);
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send('Invalid webhook signature');
  }

  const app = firebaseAdmin();
  const db = admin.firestore(app);
  const eventRef = db.collection('stripe_events').doc(event.id);
  const existing = await eventRef.get();
  if (existing.exists) return res.status(200).json({ received: true, duplicate: true });
  await eventRef.create({ type: event.type, receivedAt: admin.firestore.FieldValue.serverTimestamp() });

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const reference = String(session.client_reference_id || session.metadata?.uid || '');
    const [uid, planFromReference] = reference.split(':');
    const plan = session.metadata?.plan || planFromReference;
    if (uid && ['plus', 'pro'].includes(plan)) {
      await saveSubscription(uid, {
        plan,
        status: 'active',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null,
        currentPeriodEnd: toMillis(session.subscription?.current_period_end),
        cancelAtPeriodEnd: false,
        source: 'stripe'
      });
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const matches = await db.collection('subscriptions')
      .where('stripeSubscriptionId', '==', subscription.id).limit(1).get();
    if (!matches.empty) {
      const uid = matches.docs[0].id;
      const deleted = event.type === 'customer.subscription.deleted';
      await saveSubscription(uid, {
        plan: deleted ? 'free' : undefined,
        status: deleted ? 'cancelled' : subscription.status,
        currentPeriodEnd: toMillis(subscription.current_period_end),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        stripeSubscriptionId: subscription.id,
        source: 'stripe'
      });
    }
  }

  return res.status(200).json({ received: true });
};
