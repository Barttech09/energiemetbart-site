// Netlify roept deze functie automatisch aan bij ELKE formulierinzending op de site
// (bestandsnaam "submission-created" is een vaste Netlify-conventie, geen configuratie nodig).
// De functie stuurt de gegevens door naar een Google Apps Script Web App, die ze
// als nieuwe rij toevoegt aan het CRM-Google Sheet.
//
// Vereist: environment variable CRM_WEBHOOK_URL met de Apps Script Web App-URL.
// (Site settings > Environment variables in Netlify, of via Bart's eigen verzoek gezet.)

exports.handler = async (event) => {
  const webhookUrl = process.env.CRM_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('CRM_WEBHOOK_URL is niet ingesteld — submission wordt niet doorgestuurd.');
    return { statusCode: 200, body: 'ok (no webhook configured)' };
  }

  try {
    const payload = JSON.parse(event.body);
    const data = payload.payload && payload.payload.data ? payload.payload.data : {};
    const formName = (payload.payload && payload.payload.form_name) || 'onbekend';

    const row = {
      timestamp: new Date().toISOString(),
      form: formName,
      naam: data.naam || data.name || '',
      bedrijf: data.bedrijfsnaam || data.bedrijf || '',
      email: data.email || '',
      telefoon: data.telefoon || data.phone || '',
      verbruik_stroom: data.verbruik_stroom || data.verbruik || '',
      verbruik_gas: data.verbruik_gas || '',
      einddatum: data.einddatum || '',
      bron_pagina: data.bron_pagina || '',
      toestemming: data.toestemming ? 'Ja' : '',
      bericht: data.bericht || data.opmerkingen || data.message || ''
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('Kon submission niet doorsturen naar CRM:', err);
    // Geef altijd 200 terug — een falende CRM-koppeling mag de formulierinzending zelf niet blokkeren.
    return { statusCode: 200, body: 'error logged' };
  }
};
