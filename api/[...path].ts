import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from './_apiApp.js';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(
    req as unknown as Parameters<typeof app>[0],
    res as unknown as Parameters<typeof app>[1]
  );
}
