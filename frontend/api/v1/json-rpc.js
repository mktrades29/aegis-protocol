/**
 * Vercel Serverless Function — proxies JSON-RPC to OP_NET regtest node.
 * Retries once on 502 (Cloudflare intermittent errors).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const target = 'https://regtest.opnet.org/api/v1/json-rpc';
  const body = JSON.stringify(req.body);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (response.ok) {
        const data = await response.json();
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(data);
      }

      // Retry on 502/503/504 (Cloudflare errors)
      if (response.status >= 502 && response.status <= 504 && attempt < 2) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      // Forward non-retryable errors
      const text = await response.text();
      return res.status(response.status).send(text);
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res.status(500).json({ error: err.message || 'Proxy error' });
    }
  }
}
