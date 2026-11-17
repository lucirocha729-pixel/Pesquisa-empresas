import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from './_apiApp.js';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url) {
    const parsed = new URL(req.url, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__api_path');
    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__api_path');
      const cleanSubpath = rewrittenPath.replace(/^\/+/, '');
      const remainingQuery = parsed.searchParams.toString();
      req.url = `/api/${cleanSubpath}${remainingQuery ? `?${remainingQuery}` : ''}`;
    }
  }

  return app(
    req as unknown as Parameters<typeof app>[0],
    res as unknown as Parameters<typeof app>[1]
  );
}
