import { handler } from '../server.mjs';
import { Readable } from 'node:stream';

export default async function api(req, res) {
  if (process.env.APP_RUNTIME !== 'cloud') {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Cloud configuration is required.' }));
    return;
  }
  // Vercel may parse the body before invoking the function. The shared local
  // handler reads a bounded stream, so reconstruct it when a parsed body exists.
  if (req.body !== undefined && !['GET', 'HEAD'].includes(req.method)) {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    const request = Object.assign(Readable.from([raw]), {
      method: req.method, url: req.url, headers: req.headers, socket: req.socket
    });
    return handler(request, res);
  }
  return handler(req, res);
}
