import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { assessmentId, advisorEmail, successUrl, cancelUrl } = req.body || {};
        if (!assessmentId) {
            res.status(400).json({ error: 'Missing assessmentId' });
            return;
        }
        if (!advisorEmail) {
            res.status(400).json({ error: 'Missing advisorEmail' });
            return;
        }
        if (!STRIPE_PRICE_ID) {
            console.error('STRIPE_PRICE_ID not configured');
            res.status(500).json({ error: 'Stripe price ID not configured' });
            return;
        }
        // Default URLs if not provided
        const defaultSuccessUrl = successUrl || `${req.headers.origin || 'http://localhost:5173'}/advisor/dashboard?payment=success`;
        const defaultCancelUrl = cancelUrl || `${req.headers.origin || 'http://localhost:5173'}/advisor/dashboard?payment=cancelled`;
        console.log('Creating checkout session for assessment:', assessmentId);
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price: STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            customer_email: advisorEmail,
            metadata: {
                assessment_id: assessmentId,
                advisor_email: advisorEmail,
            },
            success_url: defaultSuccessUrl,
            cancel_url: defaultCancelUrl,
            payment_intent_data: {
                metadata: {
                    assessment_id: assessmentId,
                    advisor_email: advisorEmail,
                },
            },
        });
        console.log('Checkout session created:', session.id);
        res.status(200).json({
            sessionId: session.id,
            url: session.url,
        });
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message,
        });
    }
}
