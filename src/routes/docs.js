import { Router } from 'express';

export function createDocsRouter() {
    const router = Router();

    const spec = {
        openapi: '3.0.3',
        info: {
            title: 'Sync Pipeline API',
            version: '1.0.0',
            description: 'Minimal API surface for syncing records from HubSpot, payments, and Google Calendar.'
        },
        servers: [
            {
                url: '/',
                description: 'Current deployment'
            }
        ],
        paths: {
            '/health': {
                get: {
                    summary: 'Health check',
                    responses: {
                        200: {
                            description: 'Service is healthy'
                        }
                    }
                }
            },
            '/sync/run': {
                post: {
                    summary: 'Run a sync cycle',
                    requestBody: {
                        required: false,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        sources: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        },
                                        forceStaleCursorFor: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        },
                                        simulateErrorFor: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: 'Sync completed'
                        }
                    }
                }
            },
            '/records': {
                get: {
                    summary: 'List normalized records',
                    responses: {
                        200: {
                            description: 'Return all normalized records'
                        }
                    }
                }
            },
            '/webhook/{source}': {
                post: {
                    summary: 'Ingest a webhook event',
                    parameters: [
                        {
                            name: 'source',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' }
                        }
                    ],
                    responses: {
                        200: {
                            description: 'Webhook accepted'
                        }
                    }
                }
            },
            '/admin/seed': {
                post: {
                    summary: 'Seed sample data',
                    responses: {
                        200: {
                            description: 'Seeded sample data'
                        }
                    }
                }
            },
            '/admin/sync/status': {
                get: {
                    summary: 'Get sync status',
                    responses: {
                        200: {
                            description: 'Current sync status'
                        }
                    }
                }
            }
        }
    };

    router.get('/', (req, res) => {
        res.type('html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sync Pipeline API</title>
    <style>
      :root { color-scheme: dark; }
      body { font-family: Arial, sans-serif; margin: 0; background: #111827; color: #f9fafb; }
      main { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
      .card { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
      code, pre { font-family: Consolas, monospace; }
      code { background: #374151; padding: 0.15rem 0.35rem; border-radius: 4px; }
      pre { background: #0f172a; padding: 1rem; border-radius: 8px; overflow-x: auto; }
      a { color: #60a5fa; }
      .pill { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 999px; background: #2563eb; font-size: 0.9rem; margin-right: 0.5rem; }
      button { background: #10b981; color: white; border: none; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; }
      .example { margin-bottom: 1rem; padding: 0.9rem; border: 1px solid #374151; border-radius: 8px; background: #0f172a; }
      .example-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
      .example pre { margin: 0.25rem 0 0; }
      .example-output { margin-top: 0.6rem; white-space: pre-wrap; font-size: 0.95rem; color: #d1fae5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Sync Pipeline API</h1>
      <p>Use this page as a lightweight API UI for the sync backend. The spec is also exposed as <a href="/docs/openapi.json">/docs/openapi.json</a>.</p>

      <div class="card">
        <h2>Available endpoints</h2>
        <ul>
          <li><span class="pill">GET</span> <code>/health</code> – health check</li>
          <li><span class="pill">POST</span> <code>/sync/run</code> – trigger a sync</li>
          <li><span class="pill">GET</span> <code>/records</code> – inspect normalized records</li>
          <li><span class="pill">POST</span> <code>/webhook/:source</code> – ingest a webhook</li>
          <li><span class="pill">POST</span> <code>/admin/seed</code> – seed sample data</li>
          <li><span class="pill">GET</span> <code>/admin/sync/status</code> – view sync state</li>
        </ul>
      </div>

      <div class="card">
        <h2>Quick check</h2>
        <button id="healthButton">Call /health</button>
        <pre id="result">Waiting for a request...</pre>
      </div>

      <div class="card">
        <h2>Runtime examples</h2>

        <div class="example">
          <div class="example-header">
            <h3>GET /health</h3>
            <button data-run="health">Run</button>
          </div>
          <pre>curl https://your-app-name.onrender.com/health</pre>
          <div class="example-output" id="output-health">Click Run to execute.</div>
        </div>

        <div class="example">
          <div class="example-header">
            <h3>POST /sync/run</h3>
            <button data-run="sync">Run</button>
          </div>
          <pre>curl -X POST https://your-app-name.onrender.com/sync/run -H "Content-Type: application/json" -d '{"sources":["hubspot","payments","calendar"]}'</pre>
          <div class="example-output" id="output-sync">Click Run to execute.</div>
        </div>

        <div class="example">
          <div class="example-header">
            <h3>GET /records</h3>
            <button data-run="records">Run</button>
          </div>
          <pre>curl https://your-app-name.onrender.com/records</pre>
          <div class="example-output" id="output-records">Click Run to execute.</div>
        </div>

        <div class="example">
          <div class="example-header">
            <h3>POST /webhook/payments</h3>
            <button data-run="webhook">Run</button>
          </div>
          <pre>curl -X POST https://your-app-name.onrender.com/webhook/payments -H "Content-Type: application/json" -d '{"id":"pay-999","invoiceNo":"INV-999","amount":500,"status":"paid"}'</pre>
          <div class="example-output" id="output-webhook">Click Run to execute.</div>
        </div>

        <div class="example">
          <div class="example-header">
            <h3>POST /admin/seed</h3>
            <button data-run="seed">Run</button>
          </div>
          <pre>curl -X POST https://your-app-name.onrender.com/admin/seed</pre>
          <div class="example-output" id="output-seed">Click Run to execute.</div>
        </div>

        <div class="example">
          <div class="example-header">
            <h3>GET /admin/sync/status</h3>
            <button data-run="status">Run</button>
          </div>
          <pre>curl https://your-app-name.onrender.com/admin/sync/status</pre>
          <div class="example-output" id="output-status">Click Run to execute.</div>
        </div>
      </div>
    </main>

    <script>
      const runExample = async (endpoint, outputId) => {
        const output = document.getElementById(outputId);
        output.textContent = 'Running...';
        try {
          let response;
          switch (endpoint) {
            case 'health':
              response = await fetch('/health');
              break;
            case 'sync':
              response = await fetch('/sync/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sources: ['hubspot', 'payments', 'calendar'] })
              });
              break;
            case 'records':
              response = await fetch('/records');
              break;
            case 'webhook':
              response = await fetch('/webhook/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: 'pay-999', invoiceNo: 'INV-999', amount: 500, status: 'paid' })
              });
              break;
            case 'seed':
              response = await fetch('/admin/seed', { method: 'POST' });
              break;
            case 'status':
              response = await fetch('/admin/sync/status');
              break;
            default:
              throw new Error('Unknown endpoint');
          }

          const text = await response.text();
          try {
            output.textContent = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            output.textContent = text || 'No response body';
          }
        } catch (error) {
          output.textContent = error.message;
        }
      };

      document.getElementById('healthButton').addEventListener('click', async () => {
        const result = document.getElementById('result');
        try {
          const response = await fetch('/health');
          const data = await response.json();
          result.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
          result.textContent = error.message;
        }
      });

      document.querySelectorAll('[data-run]').forEach((button) => {
        button.addEventListener('click', () => {
          runExample(button.getAttribute('data-run'), 'output-' + button.getAttribute('data-run'));
        });
      });
    </script>
  </body>
</html>`);
    });

    router.get('/openapi.json', (req, res) => {
        res.json(spec);
    });

    return router;
}
