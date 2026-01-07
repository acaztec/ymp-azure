import Stripe from 'stripe';
import { query } from './_shared/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let event;

  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : await buffer(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('No stripe-signature header');
      res.status(400).json({ error: 'No stripe-signature header' });
      return;
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    event = stripe.webhooks.constructEvent(buf, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  console.log('Received event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);

        const assessmentId = session.metadata?.assessment_id;
        const advisorEmail = session.metadata?.advisor_email;

        if (!assessmentId || !advisorEmail) {
          console.error('Missing metadata in checkout session:', session.metadata);
          res.status(400).json({ error: 'Missing metadata' });
          return;
        }

        const assessmentResult = await query(
          'SELECT is_trial FROM advisor_assessments WHERE id = @assessmentId',
          { assessmentId }
        );
        const isTrial = assessmentResult.recordset?.[0]?.is_trial || false;
        if (isTrial) {
          console.log('⚠️ Trial assessment should not require payment:', assessmentId);
        }

        const now = new Date().toISOString();

        await query(
          `INSERT INTO stripe_orders (stripe_checkout_session_id, stripe_customer_id, email, amount, currency, status, stripe_payment_intent_id, metadata, updated_at)
           VALUES (@sessionId, @customerId, @advisorEmail, @amount, @currency, @status, @paymentIntent, @metadata, @updatedAt)`,
          {
            sessionId: session.id,
            customerId: session.customer || 'guest',
            advisorEmail,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            status: 'completed',
            paymentIntent: session.payment_intent,
            metadata: JSON.stringify(session.metadata || {}),
            updatedAt: now,
          }
        );

        await query(
          `UPDATE assessment_results SET is_unlocked = 1, unlocked_at = @now, checkout_session_id = @sessionId WHERE assessment_id = @assessmentId`,
          { now, sessionId: session.id, assessmentId }
        );

        await query(
          `UPDATE advisor_assessments SET is_paid = 1, paid_at = @now, last_checkout_session_id = @sessionId WHERE id = @assessmentId`,
          { now, sessionId: session.id, assessmentId }
        );

        console.log('Successfully unlocked assessment:', assessmentId);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        console.log('Checkout session expired:', session.id);

        await query(
          'UPDATE stripe_orders SET status = @status, updated_at = @updatedAt WHERE stripe_checkout_session_id = @sessionId',
          { status: 'expired', updatedAt: new Date().toISOString(), sessionId: session.id }
        );

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('Payment failed:', paymentIntent.id);

        await query(
          'UPDATE stripe_orders SET status = @status, updated_at = @updatedAt WHERE stripe_payment_intent_id = @paymentIntentId',
          { status: 'failed', updatedAt: new Date().toISOString(), paymentIntentId: paymentIntent.id }
        );

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error?.message || 'Unexpected error occurred while processing webhook',
    });
  }
}
