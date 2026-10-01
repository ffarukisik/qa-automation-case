import express from 'express';

const app = express();
app.use(express.json());

const VALID_USER = process.env.API_USER ?? 'testuser';
const VALID_PASS = process.env.API_PASSWORD ?? 'testpass';
const VALID_TOKEN = 'mock-token-123';

app.post('/token', (req, res) => {
  const user = req.header('user');
  const pass = req.header('pass');
  if (user !== VALID_USER || pass !== VALID_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  return res.json({ token: VALID_TOKEN });
});

app.get('/viewInvoice', (req, res) => {
  const barcode = String(req.query.barcode ?? '');
  if (!barcode) return res.status(400).json({ error: 'barcode is required' });
  return res.json({
    InvoiceLink: 'http://abc.com/invoice.pdf',
    Result: { success: true },
  });
});

app.post('/sendInvoice', (req, res) => {
  const token = req.header('token');
  const barcode = req.body?.Barcode;
  if (token !== VALID_TOKEN) return res.status(401).json({ error: 'Invalid token' });
  if (!barcode) return res.status(400).json({ error: 'Barcode is required' });
  return res.json({ Result: { success: true }, Barcode: String(barcode) });
});

const port = Number(process.env.MOCK_PORT ?? 3001);
app.listen(port, () => console.log(`Mock API listening on http://0.0.0.0:${port}`));
