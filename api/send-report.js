/**
 * Antara — Layer 3 Serverless Function
 * Vercel Edge/Node function: /api/send-report
 *
 * Receives a POST with the user's data, generates an interpretation
 * via the Anthropic API, and emails the report PDF link via Resend.
 *
 * Environment variables required (set in Vercel dashboard):
 *   ANTHROPIC_API_KEY   — your Anthropic API key
 *   RESEND_API_KEY      — your Resend API key
 *   FROM_EMAIL          — verified sender, e.g. reports@antara.in
 *   SITE_URL            — e.g. https://antara-alpha.vercel.app
 *
 * Request body (JSON):
 *   {
 *     reportType : "biorhythm_monthly" | "biorhythm_critical" | "biorhythm_compat",
 *     name       : "Aarti Gupta",
 *     dob        : "1962-10-08",          // ISO date
 *     email      : "aarti@example.com",
 *     time       : "13:20",               // optional, for horoscope reports
 *     place      : "Dehradun, India",     // optional
 *     partnerName: "...",                 // optional, for compat report
 *     partnerDob : "...",                 // optional, for compat report
 *     cycleData  : { phy, emo, int, spi } // pre-calculated values from the browser
 *   }
 */

// ─── Report type configuration ───────────────────────────────────────────────

const REPORT_CONFIG = {
  biorhythm_monthly: {
    label:    'Biorhythm Monthly Report',
    fileSlug: 'B1_Monthly',
    prompt:   buildMonthlyPrompt,
  },
  biorhythm_critical: {
    label:    'Biorhythm Critical Days · Annual Report',
    fileSlug: 'B2_Critical_Days',
    prompt:   buildCriticalPrompt,
  },
  biorhythm_compat: {
    label:    'Biorhythm Compatibility · Special Report',
    fileSlug: 'B3_Compatibility',
    prompt:   buildCompatPrompt,
  },
};

// ─── Anthropic prompt builders ────────────────────────────────────────────────

function buildMonthlyPrompt(body) {
  const { name, dob, cycleData } = body;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const phy = cycleData?.phy ?? 0;
  const emo = cycleData?.emo ?? 0;
  const int = cycleData?.int ?? 0;
  const spi = cycleData?.spi ?? 0;

  return `You are Antara, a thoughtful guide who writes personal biorhythm interpretations in an elegant, warm, grounded tone. Avoid mystical exaggeration. Be precise and practical.

Write a SHORT personalised biorhythm interpretation for ${name} (born ${dob}) for the current month. Today is ${today}.

Their cycle values today are:
- Physical  (23-day cycle): ${phy >= 0 ? '+' : ''}${Number(phy).toFixed(2)} — ${phy > 0.5 ? 'high energy phase' : phy < -0.5 ? 'rest and recovery phase' : 'transition zone'}
- Emotional (28-day cycle): ${emo >= 0 ? '+' : ''}${Number(emo).toFixed(2)} — ${emo > 0.5 ? 'warm and receptive' : emo < -0.5 ? 'introspective' : 'emotionally transitioning'}
- Intellectual (33-day cycle): ${int >= 0 ? '+' : ''}${Number(int).toFixed(2)} — ${int > 0.5 ? 'sharp and analytical' : int < -0.5 ? 'intuitive over logical' : 'mental recalibration'}
- Spiritual (53-day cycle): ${spi >= 0 ? '+' : ''}${Number(spi).toFixed(2)} — ${spi > 0.5 ? 'aligned with purpose' : spi < -0.5 ? 'seeking deeper meaning' : 'spiritual crossroads'}

Write 3 short paragraphs (60–80 words each). Use plain prose only — no markdown, no asterisks, no headings, no bullet points:
1. Overall tone of this month given these positions.
2. Practical guidance for the high-energy cycles.
3. What the low or crossing cycles suggest for rest and adjustment.

Use ${name}'s first name once. Do not use clichés like "journey", "universe", or "manifest". Write as if to an intelligent adult who appreciates candour.`;
}

function buildCriticalPrompt(body) {
  const { name, dob } = body;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `You are Antara, a thoughtful guide who writes personalised biorhythm interpretations in an elegant, grounded tone.

Write a SHORT introduction paragraph (80–100 words) for ${name}'s Biorhythm Critical Days Annual Report (starting ${today}).

Explain what critical days mean for this person in practical terms — the value of knowing in advance when cycles cross zero, and how to use this report for planning rather than prediction. Be warm but precise. Mention that physical crossings deserve particular attention for physical activities, and that multi-cycle crossing days are worth marking in one's calendar.

Use ${name}'s first name once. Avoid mystical language.`;
}

function buildCompatPrompt(body) {
  const { name, partnerName, cycleData } = body;
  const overall = cycleData?.overall ?? 50;

  return `You are Antara, a thoughtful guide who writes personalised biorhythm compatibility interpretations in a warm, intelligent, non-predictive tone.

Write a SHORT compatibility overview (80–100 words) for ${name} and ${partnerName || 'their partner'}. Their three-month overall biorhythmic compatibility score is ${overall}%.

${overall >= 70
  ? 'This is a high alignment period. Describe what this means practically — shared energy, ease of communication, good timing for joint ventures.'
  : overall >= 50
    ? 'This is a moderate compatibility period. Both resonance and complementarity are present. Describe how the differences can be navigated with awareness.'
    : 'This is a complementary rather than resonant period. Describe how opposite phases can enrich the relationship when understood rather than resisted.'}

Use first names once each. Be grounded and avoid clichés.`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS headers — allow the Vercel site to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (e) { res.status(400).json({ error: 'Invalid JSON body' }); return; }

  const { reportType, name, email } = body;

  if (!name || !email || !reportType) {
    res.status(400).json({ error: 'name, email and reportType are required' });
    return;
  }

  const config = REPORT_CONFIG[reportType];
  if (!config) {
    res.status(400).json({ error: `Unknown reportType: ${reportType}` });
    return;
  }

  // ── 1. Generate interpretation via Anthropic API ──
  let interpretation = '';
  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: config.prompt(body) }],
      }),
    });
    const data = await anthropicRes.json();
    interpretation = data?.content?.[0]?.text || '';
  } catch (e) {
    console.error('Anthropic API error:', e);
    // Non-fatal — we still send the email, just without the interpretation
  }

  // ── 2. Build the report URL ──
  const siteUrl = (process.env.SITE_URL || 'https://antara-alpha.vercel.app').replace(/\/$/, '');
  const reportUrl = `${siteUrl}/${config.fileSlug}.html`;

  // ── 3. Send email via Resend ──
  const firstName = name.trim().split(' ')[0];
  const emailHtml = buildEmailHtml({ firstName, name, config, reportUrl, interpretation, body });

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Antara Reports <reports@antara.in>',
        to:   [email],
        subject: `Your ${config.label} — Antara`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error:', resendRes.status, errText);
      res.status(502).json({ error: 'Email delivery failed', detail: errText });
      return;
    }

    const resendData = await resendRes.json();
    res.status(200).json({ success: true, emailId: resendData.id, reportUrl });

  } catch (e) {
    console.error('Resend fetch error:', e);
    res.status(502).json({ error: 'Email delivery failed', detail: e.message });
  }
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml({ firstName, name, config, reportUrl, interpretation, body }) {
  const dobFormatted = body.dob
    ? new Date(body.dob + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

 const interpretationHtml = interpretation
    ? interpretation
        .replace(/^## (.+)$/gm, '<strong style="display:block;margin:14px 0 4px;font-size:13px;color:#2a3340;letter-spacing:0.04em;">$1</strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p style="margin:8px 0 0;">')
        .replace(/^/, '<p style="margin:0">')
        .replace(/$/, '</p>')
    : '';

  const interpretationBlock = interpretationHtml
    ? `<div style="margin:24px 0;padding:20px 24px;background:#f8f4e8;border-left:3px solid #a88842;border-radius:2px;">
        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#a88842;font-weight:700;margin-bottom:10px;">Your Personalised Interpretation</div>
        <div style="font-size:14px;line-height:1.65;color:#2a3340;font-family:Georgia,serif;">${interpretationHtml}</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#c4c0b0;font-family:'Georgia',serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#c4c0b0;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#f2dfc0;border-radius:2px;box-shadow:0 4px 18px rgba(0,0,0,0.15);">

  <!-- Header -->
  <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #c8a85c;text-align:center;">
    <div style="font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#a88842;font-weight:700;margin-bottom:8px;">ANTARA · अन्तर</div>
    <div style="font-size:24px;font-weight:600;color:#2a3340;letter-spacing:0.04em;">${config.label}</div>
    <div style="font-size:13px;font-style:italic;color:#6d6553;margin-top:4px;">Your personal reading</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:24px 36px 0;">
    <p style="font-size:16px;color:#2a3340;line-height:1.5;margin:0;">Dear ${firstName},</p>
    <p style="font-size:14px;color:#3d4554;line-height:1.6;margin:14px 0 0;">
      Your <strong style="color:#2a3340;">${config.label}</strong> has been prepared for you.
      ${dobFormatted ? `It is calculated from your date of birth — <strong>${dobFormatted}</strong>.` : ''}
    </p>
  </td></tr>

  <!-- Interpretation block -->
  <tr><td style="padding:0 36px;">${interpretationBlock}</td></tr>

  <!-- CTA -->
  <tr><td style="padding:24px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <a href="${reportUrl}" style="display:inline-block;background:#6b1a2c;color:#f5e8c8;font-family:Georgia,serif;font-size:14px;font-weight:700;letter-spacing:0.08em;text-decoration:none;padding:14px 36px;border-radius:2px;">
        Open Your Report &nbsp;→
      </a>
    </td></tr>
    </table>
    <p style="font-size:11px;color:#8a7d60;text-align:center;margin:12px 0 0;">
      Opens in your browser — no app or login required
    </p>
  </td></tr>

  <!-- Divider + note -->
  <tr><td style="padding:0 36px 20px;border-top:1px solid #c8a85c;">
    <p style="font-size:11.5px;color:#6d6553;line-height:1.6;margin:20px 0 0;">
      Antara reads the inner register — the rhythms beneath each day. This report is interpretative, not predictive. Use it as a lens of awareness, not a deterministic guide.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 36px;background:#e6d9b8;border-radius:0 0 2px 2px;text-align:center;">
    <div style="font-size:10px;letter-spacing:0.14em;color:#8a7060;">ANTARA PERSONAL READING · अन्तर · Interior Register</div>
    <div style="font-size:10px;color:#a09080;margin-top:4px;">interpretative, not Predictive</div>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}
