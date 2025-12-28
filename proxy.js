const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const LOCAL_URL = process.env.LOCAL_URL; // Twój lokalny backend, np. https://xxxx.trycloudflare.com
const MAX_RETRY = 3;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL; // Discord webhook URL do logów

// Funkcja logująca do Discorda
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

app.post('/webhook', async (req, res) => {
  console.log('Webhook received:', req.body);
  await logToDiscord(`Webhook received: ${JSON.stringify(req.body)}`);

  if (!LOCAL_URL) {
    console.log('Local backend offline. Skipping forward.');
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
    console.log('Failed to forward webhook after retries');
    await logToDiscord('Failed to forward webhook after retries');
    return res.status(502).send('Failed to forward webhook');
  }

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('Proxy running on port 3000');
});
