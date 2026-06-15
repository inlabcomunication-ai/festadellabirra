const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const { adulti, bambini, nome, telefono } = req.body;

  const lineItems = [];

  if (adulti > 0) {
    lineItems.push({
      price: 'price_1TidqmCAI1ZfdIAk5VsOE61w',
      quantity: parseInt(adulti),
    });
  }

  if (bambini > 0) {
    lineItems.push({
      price: 'price_1TiduZCAI1ZfdIAk0zwDFkoh',
      quantity: parseInt(bambini),
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.origin}/grazie.html?nome=${encodeURIComponent(nome)}&telefono=${encodeURIComponent(telefono)}&adulti=${adulti}&bambini=${bambini}&pagato=true`,
      cancel_url: `${req.headers.origin}/#prenota`,
      metadata: { nome, telefono, adulti, bambini },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
