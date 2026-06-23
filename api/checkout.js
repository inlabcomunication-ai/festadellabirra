const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const { adulti, bambini, nome, telefono, priceAdult, priceChild, successUrl, cancelUrl } = req.body;

  const lineItems = [];

  if (parseInt(adulti) > 0 && priceAdult) {
    lineItems.push({ price: priceAdult, quantity: parseInt(adulti) });
  }
  if (parseInt(bambini) > 0 && priceChild) {
    lineItems.push({ price: priceChild, quantity: parseInt(bambini) });
  }

  if (!lineItems.length) {
    return res.status(400).json({ error: 'Nessun articolo nel carrello' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'paypal', 'klarna'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { nome, telefono },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
