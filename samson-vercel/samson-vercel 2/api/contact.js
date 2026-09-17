'use strict';
/**
 * Samson Pest Control estimate form handler (Vercel serverless function, Node.js, zero dependencies).
 *
 * The website form posts here. The request is emailed through your mailbox's SMTP server.
 * Browsers with JavaScript get a JSON reply ({ ok: true } or { ok: false, error }); plain form posts
 * are redirected to a thank-you, error or unavailable page.
 *
 * Configure in Vercel (Project -> Settings -> Environment Variables), then redeploy:
 *
 *   SMTP_HOST       e.g. smtp.gmail.com / smtp.office365.com / smtp.zoho.com / smtp.hostinger.com
 *   SMTP_PORT       465 (SSL, default) or 587 (STARTTLS)
 *   SMTP_USER       full mailbox address used to sign in
 *   SMTP_PASS       app password for that mailbox
 *   MAIL_TO         where requests go (default vern@samsonpestcontrolpa.com; comma-separate several)
 *   MAIL_FROM       optional, defaults to SMTP_USER (must be allowed to send from that mailbox)
 *   MAIL_FROM_NAME  optional, defaults to "Samson Pest Control Website"
 *   SMTP_SECURE     optional override: "ssl" or "starttls" (otherwise picked from the port)
 */
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

const PAGES = {
  form: '/contact/#estimate',
  sent: '/contact/thank-you/',
  invalid: '/contact/error/',
  failed: '/contact/unavailable/',
};
const SEND_TIMEOUT_MS = 12000;
const NUL = String.fromCharCode(0); // separator required by SMTP AUTH PLAIN

function config() {
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = (process.env.SMTP_SECURE || (port === 465 ? 'ssl' : 'starttls')).trim().toLowerCase();
  const user = (process.env.SMTP_USER || '').trim();
  return {
    host: (process.env.SMTP_HOST || '').trim(),
    port,
    secure, // 'ssl' (implicit TLS) or 'starttls'. Plain-text SMTP is deliberately not supported.
    user,
    pass: process.env.SMTP_PASS || '',
    to: (process.env.MAIL_TO || 'vern@samsonpestcontrolpa.com').split(',').map((s) => s.trim()).filter(Boolean),
    from: (process.env.MAIL_FROM || user).trim(),
    fromName: (process.env.MAIL_FROM_NAME || 'Samson Pest Control Website').trim(),
  };
}

/* ---------------- request helpers ---------------- */

const EMAIL_RE = /^[^\s@<>(),;:"[\]\\]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const oneLine = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

async function readForm(req) {
  // Vercel's Node helpers usually parse urlencoded/JSON bodies into req.body already.
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw;
  if (typeof req.body === 'string') raw = req.body;
  else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
  else {
    raw = await new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      const t = setTimeout(() => reject(new Error('body read timeout')), 5000);
      req.on('data', (c) => {
        size += c.length;
        if (size > 64 * 1024) { clearTimeout(t); reject(new Error('body too large')); req.destroy(); } else chunks.push(c);
      });
      req.on('end', () => { clearTimeout(t); resolve(Buffer.concat(chunks).toString('utf8')); });
      req.on('error', (e) => { clearTimeout(t); reject(e); });
    });
  }
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    try { return JSON.parse(raw || '{}') || {}; } catch { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(raw || ''));
}

function wantsJson(req) {
  return String(req.headers.accept || '').includes('application/json');
}

function reply(req, res, outcome) {
  res.setHeader('Cache-Control', 'no-store');
  if (wantsJson(req)) {
    const ok = outcome === 'sent';
    res.statusCode = ok ? 200 : outcome === 'invalid' ? 400 : outcome === 'form' ? 405 : 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(ok ? { ok: true } : { ok: false, error: outcome }));
    return;
  }
  res.statusCode = 303;
  res.setHeader('Location', PAGES[outcome]);
  res.end();
}

/* ---------------- message building ---------------- */

const isAscii = (s) => /^[\x20-\x7e]*$/.test(s);

// RFC 2047 encoded-words, split so each one stays within the 75-character limit.
function encodeWords(s) {
  if (isAscii(s)) return s;
  const words = [];
  let chunk = '';
  for (const ch of s) {
    if (Buffer.byteLength(chunk + ch, 'utf8') > 42) { words.push(chunk); chunk = ''; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ');
}

function mailbox(name, email) {
  const n = String(name || '').replace(/["\\\r\n]/g, '').trim();
  if (!n) return `<${email}>`;
  return `${isAscii(n) ? `"${n}"` : encodeWords(n)} <${email}>`;
}

function buildMessage(cfg, msg) {
  const domain = cfg.from.split('@')[1] || 'localhost';
  const headers = [
    `From: ${mailbox(cfg.fromName, cfg.from)}`,
    `To: ${cfg.to.join(', ')}`,
    `Reply-To: ${mailbox(msg.replyName, msg.replyEmail)}`,
    `Subject: ${encodeWords(msg.subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  // base64 body: safe for any language, and no line-length or dot-stuffing problems
  const body = Buffer.from(msg.body.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{1,76}/g, '$&\r\n')
    .trimEnd();
  return `${headers.join('\r\n')}\r\n\r\n${body}`;
}

/* ---------------- minimal SMTP client (SSL:465 or STARTTLS:587, AUTH LOGIN/PLAIN) ---------------- */

function smtpSend(cfg, msg) {
  return new Promise((resolve, reject) => {
    let socket;
    let buffer = '';
    let settled = false;
    let step = 'connecting';
    const waiting = [];
    const timer = setTimeout(() => {
      const hint = cfg.secure === 'starttls' && (step === 'connecting' || step === 'greeting')
        ? ' (if this port expects SSL/TLS from the first byte, like 465, set SMTP_SECURE=ssl)'
        : '';
      fail(new Error(`SMTP timed out during ${step}${hint}`));
    }, SEND_TIMEOUT_MS);

    function fail(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (socket) socket.destroy(); } catch { /* ignore */ }
      reject(err);
    }
    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.end(); } catch { /* ignore */ }
      resolve();
    }

    function onData(chunk) { buffer += chunk.toString('utf8'); pump(); }
    function pump() {
      while (waiting.length) {
        let pos = 0;
        let end = -1;
        for (;;) {
          const nl = buffer.indexOf('\n', pos);
          if (nl < 0) break;
          const line = buffer.slice(pos, nl).replace(/\r$/, '');
          pos = nl + 1;
          if (line.length < 4 || line[3] === ' ') { end = pos; break; } // "250 ok" ends a reply; "250-..." continues it
        }
        if (end < 0) return;
        const lines = buffer.slice(0, end).split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean);
        buffer = buffer.slice(end);
        waiting.shift()({ code: parseInt(lines[lines.length - 1].slice(0, 3), 10), lines });
      }
    }
    const read = () => new Promise((r) => { waiting.push(r); pump(); });
    const send = (line) => socket.write(`${line}\r\n`);
    async function expect(codes, stepName) {
      step = stepName;
      const reply = await read();
      if (!codes.includes(reply.code)) throw new Error(`${stepName} rejected: ${reply.lines.join(' | ').slice(0, 300)}`);
      return reply;
    }
    const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
    const onClose = () => fail(new Error('connection closed by the mail server'));
    function attach(s) {
      s.on('data', onData);
      s.on('error', fail);
      s.on('close', onClose);
    }

    function startTls() {
      return new Promise((res, rej) => {
        socket.removeListener('data', onData);
        socket.removeListener('close', onClose);
        const secured = tls.connect({ socket, servername: cfg.host }, () => res(secured)); // certificate is verified
        secured.once('error', rej);
      });
    }

    async function conversation() {
      const ehloName = String(process.env.VERCEL_URL || 'samson-website').replace(/[^A-Za-z0-9.-]/g, '') || 'localhost';
      await expect([220], 'greeting');
      send(`EHLO ${ehloName}`);
      let ehlo = await expect([250], 'EHLO');
      if (cfg.secure === 'starttls') {
        if (!ehlo.lines.some((l) => /STARTTLS/i.test(l))) throw new Error('the server does not offer STARTTLS on this port');
        send('STARTTLS');
        await expect([220], 'STARTTLS');
        buffer = '';
        socket = await startTls();
        attach(socket);
        send(`EHLO ${ehloName}`);
        ehlo = await expect([250], 'EHLO after STARTTLS');
      }
      const authLine = (ehlo.lines.join('\n').toUpperCase().match(/AUTH[ =][^\n]*/) || [''])[0];
      if (/\bPLAIN\b/.test(authLine) && !/\bLOGIN\b/.test(authLine)) {
        send(`AUTH PLAIN ${b64(NUL + cfg.user + NUL + cfg.pass)}`);
        await expect([235], 'authentication (check SMTP_USER and SMTP_PASS)');
      } else {
        send('AUTH LOGIN');
        await expect([334], 'AUTH LOGIN');
        send(b64(cfg.user));
        await expect([334], 'SMTP username');
        send(b64(cfg.pass));
        await expect([235], 'authentication (check SMTP_USER and SMTP_PASS)');
      }
      send(`MAIL FROM:<${cfg.from}>`);
      await expect([250], 'sender address (MAIL_FROM)');
      let accepted = 0;
      step = 'recipient address (MAIL_TO)';
      for (const rcpt of cfg.to) {
        send(`RCPT TO:<${rcpt}>`);
        const r = await read();
        if (r.code === 250 || r.code === 251) accepted++;
      }
      if (!accepted) throw new Error('no recipient address was accepted (MAIL_TO)');
      send('DATA');
      await expect([354], 'DATA');
      socket.write(`${buildMessage(cfg, msg)}\r\n.\r\n`);
      await expect([250], 'message');
      send('QUIT');
    }

    if (!['ssl', 'starttls'].includes(cfg.secure)) {
      fail(new Error('SMTP_SECURE must be "ssl" or "starttls"'));
      return;
    }
    socket = cfg.secure === 'ssl'
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }) // certificate is verified
      : net.connect({ host: cfg.host, port: cfg.port });
    attach(socket);
    conversation().then(done, fail);
  });
}

/* ---------------- handler ---------------- */

async function handler(req, res) {
  if (req.method !== 'POST') return reply(req, res, 'form');

  let form;
  try { form = await readForm(req); } catch { return reply(req, res, 'invalid'); }

  if (oneLine(form.website, 200)) return reply(req, res, 'sent'); // honeypot: bots fill the hidden field

  const name = oneLine(form.name, 120);
  const email = oneLine(form.email, 200);
  const phone = oneLine(form.phone, 40);
  const town = oneLine(form.town, 80);
  const service = oneLine(form.service, 120);
  const contactPref = oneLine(form.contact_pref, 20);
  const message = String(form.message == null ? '' : form.message).replace(/\r\n?/g, '\n').trim().slice(0, 5000);
  if (!name || !EMAIL_RE.test(email) || !message) return reply(req, res, 'invalid');

  const cfg = config();
  if (!cfg.host || !cfg.user || !cfg.pass || !cfg.from || !cfg.to.length) {
    console.error('[contact] email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS in Vercel');
    return reply(req, res, 'failed');
  }

  const body = [
    'New free estimate request from the Samson Pest Control website:', '',
    `Name:          ${name}`,
    `Email:         ${email}`,
    `Phone:         ${phone || '-'}`,
    `Town:          ${town || '-'}`,
    `Interested in: ${service || '-'}`,
    `Reach by:      ${contactPref || '-'}`,
    '', 'Message:', message, '',
    `-- Sent ${new Date().toUTCString()}`,
  ].join('\n');

  try {
    await smtpSend(cfg, {
      subject: `[Website] Estimate request from ${name}${town ? ` (${town})` : ''}`,
      body,
      replyName: name,
      replyEmail: email,
    });
    return reply(req, res, 'sent');
  } catch (err) {
    console.error('[contact] sending failed:', err && err.message);
    return reply(req, res, 'failed');
  }
}

module.exports = handler;
module.exports._test = { buildMessage, encodeWords, EMAIL_RE };
