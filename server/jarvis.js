/* ============================================================
   J.A.R.V.I.S. — the bridge to Claude

   Two endpoints, mounted by server/server.js:

     GET  /api/jarvis/health  → { ready: true|false }
     POST /api/jarvis/chat    → { reply: "..." }

   The browser never sees the API key — it stays on this server.
   With no ANTHROPIC_API_KEY the bridge reports ready:false and
   the HUD falls back to its on-device command handling, which
   needs no network at all.
   ============================================================ */
'use strict';

const express = require('express');

const MODEL = process.env.JARVIS_MODEL || 'claude-opus-5';

/* The browser may pick from these and nothing else — an open model field
   would let any page on this origin bill the key against any model. */
const ALLOWED_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];

/* Server-side search: Anthropic runs it, results come back in the same
   response. Without it, anything about "now" is answered from training. */
const SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search', max_uses: 4 };

/* Jarvis is a *voice* — replies are spoken aloud by the browser,
   so the system prompt asks for speech, not prose formatting. */
const SYSTEM = [
  'You are JARVIS, a voice assistant running as a heads-up display on the user\'s own machine.',
  '',
  'Your replies are read aloud by a speech synthesiser, so:',
  '  • Write plain spoken English — no markdown, bullet points, headings, asterisks, emoji or code fences.',
  '  • Keep it to one to three sentences unless the user asks for depth.',
  '',
  'The exception: when asked to write, draft, rewrite or word something —',
  'an email, a quote, a caption, a listing — give the finished piece in full.',
  'Write only the piece itself: no preamble, no "here is", no sign-off from you.',
  'Still no markdown; it is shown as plain text and may be read aloud.',
  '  • Say numbers the way a person would say them out loud.',
  '  • Never describe what you are about to do; just answer.',
  '',
  'Manner: precise, dry, quietly witty, unhurried. Address the user directly.',
  'You are competent and calm, never sycophantic and never apologetic without cause.',
  '',
  'The HUD already handles time, date, battery, network, hardware, timers, notes and',
  'arithmetic on-device — those never reach you. You get everything else: questions,',
  'reasoning, writing, explanations, advice, conversation.',
  '',
  'A live telemetry snapshot of the user\'s machine is attached to each message.',
  'Use it when it is relevant and ignore it when it is not. Do not read it back',
  'verbatim, and do not mention that it was attached.'
].join('\n');

function buildRouter() {
  const router = express.Router();

  let client = null;
  let initError = null;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      client = new Anthropic();   // reads ANTHROPIC_API_KEY from the environment
    } catch (e) {
      initError = e.code === 'MODULE_NOT_FOUND'
        ? 'The @anthropic-ai/sdk package is not installed — run: npm install'
        : e.message;
    }
  }

  router.get('/health', (req, res) => {
    res.json({
      ready: !!client,
      model: client ? MODEL : null,
      reason: client ? null : (initError || 'ANTHROPIC_API_KEY is not set')
    });
  });

  router.post('/chat', async (req, res) => {
    if (!client) {
      return res.status(503).json({ error: initError || 'ANTHROPIC_API_KEY is not set on the server.' });
    }

    const body = req.body || {};
    const message = String(body.message || '').trim().slice(0, 4000);
    if (!message) return res.status(400).json({ error: 'Nothing to answer.' });

    // Keep the last few turns so Jarvis follows the thread, and cap them
    // so a long session can't grow the request without bound.
    const history = (Array.isArray(body.history) ? body.history : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const telemetry = String(body.telemetry || '').slice(0, 1200);
    const userContent = telemetry
      ? message + '\n\n<telemetry>\n' + telemetry + '\n</telemetry>'
      : message;

    const model = ALLOWED_MODELS.indexOf(body.model) !== -1 ? body.model : MODEL;
    const search = body.search !== false;

    try {
      let messages = history.concat([{ role: 'user', content: userContent }]);
      let response = null;

      // A long search can pause the turn; hand its output back to continue.
      for (let round = 0; round < 4; round++) {
        const params = {
          model,
          max_tokens: 1024,               // spoken replies are short by design
          system: SYSTEM,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'low' },  // a voice assistant is judged on latency
          messages
        };
        if (search) params.tools = [SEARCH_TOOL];

        response = await client.messages.create(params);
        if (response.stop_reason !== 'pause_turn') break;
        messages = messages.concat([{ role: 'assistant', content: response.content }]);
      }

      const reply = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (response.stop_reason === 'refusal') {
        return res.json({ reply: 'I would rather not answer that one.' });
      }

      res.json({ reply: reply || 'I have nothing useful to add to that.' });
    } catch (err) {
      const status = err && err.status;
      console.error('[jarvis] ' + (err && err.message ? err.message : err));
      if (status === 401) return res.status(502).json({ error: 'The Anthropic API key was rejected.' });
      if (status === 429) return res.status(502).json({ error: 'Rate limited — try again in a moment.' });
      res.status(502).json({ error: 'Claude is unreachable right now.' });
    }
  });

  return router;
}

module.exports = { buildRouter, MODEL };
