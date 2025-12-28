const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

let LOCAL_URL = null;
const PORT = process.env.PORT || 3000;

// endpoint do aktualizacji ngrok URL
app.post("/update-local-url", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send("Missing url");

  LOCAL_URL = url;
  console.log("✅ LOCAL_URL updated:", LOCAL_URL);
  res.sendStatus(200);
});

// webhook / API
app.post("/webhook", async (req, res) => {
  if (!LOCAL_URL) {
    console.log("❌ No LOCAL_URL yet");
    return res.status(503).send("Tunnel not ready");
  }

  try {
    await fetch(`${LOCAL_URL}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("Forward failed:", err.message);
    res.status(502).send("Forward failed");
  }
});

app.get("/", (_, res) => {
  res.send("Proxy OK");
});

app.listen(PORT, () => {
  console.log("🚀 Proxy running on port", PORT);
});
