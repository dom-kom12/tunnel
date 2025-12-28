const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

let LOCAL_URL = process.env.LOCAL_URL || null; // Cloudflared URL, aktualizowany dynamicznie
const MAX_RETRY = 3;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Logi do Discorda
async function logToDiscord(message) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.error('Discord logging failed:', err.message);
  }
}

// Endpoint do update LOCAL_URL (cloudflared może wysyłać POST z aktualnym URL)
app.post('/update-local-url', async (req, res) => {
  if (!req.body.url) return res.status(400).send('Missing url');
  LOCAL_URL = req.body.url;
  console.log(`LOCAL_URL updated: ${LOCAL_URL}`);
  await logToDiscord(`LOCAL_URL updated: ${LOCAL_URL}`);
  res.sendStatus(200);
});

// Endpoint webhook forwardujący requesty
app.post('/webhook', async (req, res) => {
  console.log('Webhook received:', req.body);
  await logToDiscord(`Webhook received: ${JSON.stringify(req.body)}`);

  if (!LOCAL_URL) {
    await logToDiscord('Local backend offline. Skipping forward.');
    return res.status(200).send('Local backend offline');
  }

  let attempt = 0;
  let success = false;

  while (attempt < MAX_RETRY && !success) {
    try {
      await fetch(`${LOCAL_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      success = true;
      await logToDiscord('Webhook successfully forwarded to local backend.');
    } catch (err) {
      attempt++;
      console.log(`Retry ${attempt} failed:`, err.message);
      await logToDiscord(`Retry ${attempt} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!success) {
    await logToDiscord('Failed to forward webhook after retries');
    return res.status(502).send('Failed to forward webhook');
  }

  res.sendStatus(200);
});

// Opcjonalny GET endpoint testowy
app.get('/', (req, res) => {
  res.send('Proxy running');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Proxy running on port ${process.env.PORT || 3000}`);
});
