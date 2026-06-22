const MAX_FIELD_LENGTH = 4000;

function sanitize(value = '') {
  return String(value).replace(/[<>]/g, '').trim().slice(0, MAX_FIELD_LENGTH);
}

function wantsJson(req) {
  return String(req.headers.accept || '').includes('application/json') ||
    String(req.headers['content-type'] || '').includes('application/json');
}

function respond(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf8');
  const type = String(req.headers['content-type'] || '');

  if (type.includes('application/json')) {
    return JSON.parse(raw || '{}');
  }

  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

async function sendTelegram({ name, email, subject, message }) {
  const token = process.env.CONTACT_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CONTACT_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const text = [
    'New hrwillmott.com contact form message',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    subject ? `Subject: ${subject}` : null,
    '',
    message,
  ].filter(Boolean).join('\n');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram send failed: ${response.status} ${body}`);
  }

  return true;
}

async function sendResend({ name, email, subject, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || 'contact@hrwillmott.com';
  if (!apiKey || !to) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: email,
      subject: `hrwillmott.com contact: ${subject || name}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject || '-'}\n\n${message}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }

  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);

    // Honeypot. Real users never fill this; simple bots often do.
    if (body.website) {
      return respond(res, 200, { ok: true });
    }

    const name = sanitize(body.name);
    const email = sanitize(body.email);
    const subject = sanitize(body.subject);
    const message = sanitize(body.message);

    if (!name || !email || !message) {
      return respond(res, 400, { ok: false, error: 'Name, email and message are required.' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return respond(res, 400, { ok: false, error: 'Please enter a valid email address.' });
    }

    const sentTelegram = await sendTelegram({ name, email, subject, message });
    const sentEmail = await sendResend({ name, email, subject, message });

    if (!sentTelegram && !sentEmail) {
      console.error('Contact form is not configured: set CONTACT_TELEGRAM_BOT_TOKEN + CONTACT_TELEGRAM_CHAT_ID or RESEND_API_KEY + CONTACT_TO_EMAIL.');
      return respond(res, 503, {
        ok: false,
        error: 'Contact form is not configured yet. Please try again later.',
      });
    }

    return respond(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return respond(res, 500, { ok: false, error: 'Could not send message. Please try again later.' });
  }
};
