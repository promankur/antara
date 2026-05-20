/**
 * Antara — Razorpay Order Creation
 * Vercel serverless function: /api/create-order
 *
 * Receives a POST with the cart total, creates a Razorpay order,
 * and returns the order ID for the frontend to open the checkout modal.
 *
 * Environment variables required:
 *   RAZORPAY_KEY_ID     — starts with rzp_live_...
 *   RAZORPAY_KEY_SECRET — your Razorpay secret key
 *
 * Request body (JSON):
 *   { amount: 2499, currency: "INR", receipt: "antara_1234567890" }
 *
 * Response (JSON):
 *   Razorpay order object with id, amount, currency
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (e) { res.status(400).json({ error: 'Invalid JSON body' }); return; }

  const { amount, currency = 'INR', receipt, notes = {} } = body;

  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    res.status(500).json({ error: 'Razorpay keys not configured' });
    return;
  }

  try {
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // convert ₹ to paise
        currency,
        receipt: receipt || ('antara_' + Date.now()),
        notes,
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error('Razorpay order error:', orderRes.status, errText);
      res.status(502).json({ error: 'Order creation failed', detail: errText });
      return;
    }

    const order = await orderRes.json();
    res.status(200).json(order);

  } catch (e) {
    console.error('Razorpay fetch error:', e);
    res.status(502).json({ error: 'Order creation failed', detail: e.message });
  }
}
