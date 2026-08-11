// Verifieert een Google reCAPTCHA v3-token server-side, vóórdat een formulier
// daadwerkelijk als Netlify Forms-inzending wordt geaccepteerd.
// Vereist: environment variable RECAPTCHA_SECRET_KEY (Site settings > Environment
// variables in Netlify).

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let token, action;
  try {
    const body = await req.json();
    token = body.token;
    action = body.action || '';
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = Netlify.env.get('RECAPTCHA_SECRET_KEY');
  if (!secret) {
    // Geen secret ingesteld: laat de inzending gewoon door zodat een
    // configuratiefout nooit een lead blokkeert, maar log het duidelijk.
    console.log('RECAPTCHA_SECRET_KEY ontbreekt: reCAPTCHA-check overgeslagen.');
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await verifyRes.json();

    const minScore = 0.5;
    const scoreOk = typeof data.score !== 'number' || data.score >= minScore;
    const actionOk = !action || !data.action || data.action === action;

    if (data.success && scoreOk && actionOk) {
      return new Response(JSON.stringify({ ok: true, score: data.score ?? null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: false, score: data.score ?? null, errors: data['error-codes'] || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('reCAPTCHA-verificatie mislukt:', err);
    // Technische storing bij Google: niet blokkeren, wel loggen.
    return new Response(JSON.stringify({ ok: true, degraded: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/verify-recaptcha',
};
