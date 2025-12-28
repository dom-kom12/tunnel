const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
let LOCAL_URL = process.env.LOCAL_URL || null; // render / cloudflared URL
const MAX_RETRY = 3;
let queue = [];

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

async function forwardWebhook(body) {
  let attempt = 0;
  let success = false;
  while (attempt < MAX_RETRY && !success) {
    try {
      await fetch(`${LOCAL_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      success = true;
      await logToDiscord('Webhook forwarded.');
    } catch (err) {
      attempt++;
      await logToDiscord(`Retry ${attempt} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!success) {
    queue.push(body);
    await logToDiscord('Added to queue.');
  }
}

app.post('/webhook', async (req, res) => {
  console.log('Proxy received:', req.body);
  await logToDiscord(`Proxy received: ${JSON.stringify(req.body)}`);
  if (!LOCAL_URL) {
    queue.push(req.body);
    await logToDiscord('Local backend offline, added to queue.');
    return res.status(200).send('Local backend offline, added to queue');
  }
  await forwardWebhook(req.body);
  res.sendStatus(200);
});

app.post('/update-local-url', async (req, res) => {
  if (!req.body.url) return res.status(400).send('Missing url');
  LOCAL_URL = req.body.url;
  console.log(`LOCAL_URL updated: ${LOCAL_URL}`);
  await logToDiscord(`LOCAL_URL updated: ${LOCAL_URL}`);
  res.sendStatus(200);
});

app.post('/retry-queue', async (req, res) => {
  if (!LOCAL_URL) return res.status(200).send('Local backend offline');
  const oldQueue = [...queue];
  queue = [];
  for (const item of oldQueue) {
    await forwardWebhook(item);
  }
  res.send(`Retried ${oldQueue.length} queued webhooks`);
});

app.get('/', (req, res) => res.send('Proxy running'));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Proxy running on port ${process.env.PORT || 3000}`);
});
