// server.js
// Simple Express proxy to Replicate predictions endpoint.
// Exposes POST /api/chat { message: "..." } -> returns { reply: "..." }

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());

// Allow all origins by default (Railway will be fronted by your domain).
// For stricter security put your InfinityFree domain here:
// e.g. cors({ origin: 'https://turonai.infinityfreeapp.com' })
app.use(cors());

// IMPORTANT: set these environment variables in Railway dashboard:
// REPLICATE_API_TOKEN  -> your replicate token (do NOT commit it to git)
// REPLICATE_MODEL_VERSION -> the replicate model VERSION id (UUID) or model slug if supported
// EXAMPLE: "meta/llama-2-13b-chat" or "VERSION_UUID_FROM_REPLICATE"
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION || process.env.REPLICATE_MODEL;

if (!REPLICATE_API_TOKEN) {
  console.error('ERROR: REPLICATE_API_TOKEN is not set in environment variables.');
}

// Simple static info for rule-based answers:
const TURON_INFO = {
  name: "Turon O'quv Markazi",
  address: "Marhamat shahri",
  phone: "+998 999082703",
  hours: "09:00 - 18:00 (Dushanbadan Shanbagacha)",
  courses: [
    "Dasturlash (Python, Java, Flutter)",
    "Ingliz tili",
    "Matematika va fizika",
    "Kompyuter savodxonligi"
  ]
};

// Allowed keywords (very permissive). If incoming message doesn't match,
// we return a polite refusal.
const ALLOWED = [/kurs/, /yo'nalish/, /dars/, /jadval/, /manzil/, /telefon/, /raqam/, /aloqa/, /ish vaqti/, /soat/, /o'qituvchi/, /turon/, 'kurs', 'manzil', 'telefon', 'ish vaqti', 'dasturlash', 'ingliz', 'matematika', 'fizika', 'kompyuter'];

function isAllowedQuestion(text) {
  if (!text) return false;
  const n = text.toLowerCase();
  for (const p of ALLOWED) {
    if (p instanceof RegExp) {
      if (p.test(n)) return true;
    } else if (typeof p === 'string') {
      if (n.includes(p)) return true;
    }
  }
  return false;
}

// Quick local answers (avoid LLM cost when possible)
function quickAnswer(question) {
  const n = (question || '').toLowerCase();
  if (n.includes('manzil') || n.includes('qaerda') || n.includes('joylashuv')) return TURON_INFO.address;
  if (n.includes('telefon') || n.includes('raqam')) return TURON_INFO.phone;
  if (n.includes('ish vaqti') || n.includes('soat')) return TURON_INFO.hours;
  if (n.includes('kurs') || n.includes("yo'nalish") || n.includes('dasturlash') || n.includes('ingliz'))
    return 'Hozirgi yo‘nalishlar: ' + TURON_INFO.courses.join(', ');
  return null;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    if (!isAllowedQuestion(message)) {
      return res.json({
        reply: "Kechirasiz — men faqat Turon O'quv Markazi bilan bog'liq savollarga javob bera olaman. Iltimos, kurslar, jadval, manzil yoki aloqa haqida so'rang.",
        source: 'local'
      });
    }

    // Rule-based fast answer
    const quick = quickAnswer(message);
    if (quick) return res.json({ reply: quick, source: 'local' });

    // Build prompt
    const prompt = `Siz Turon O'quv Markazi chatbotisiz. Foydalanuvchining savoliga faqat markaz haqidagi ma'lumotlar doirasida javob bering.\n\nMarkaz ma'lumotlari:\n${JSON.stringify(TURON_INFO)}\n\nSavol: "${message}"\nJavob:`;

    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Server not configured with REPLICATE_API_TOKEN' });
    }
    if (!MODEL_VERSION) {
      return res.status(500).json({ error: 'Server not configured with REPLICATE_MODEL_VERSION (or REPLICATE_MODEL)' });
    }

    // Prepare request body. Replicate often expects: { version: "VERSION_ID", input: {...} }
    const body = {
      version: MODEL_VERSION,
      input: {
        prompt: prompt,
        max_new_tokens: 256,
        temperature: 0.2
      }
    };

    const rr = await axios.post('https://api.replicate.com/v1/predictions', body, {
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });

    let prediction = rr.data;

    // If prediction is asynchronous, poll until succeeded (max ~30 attempts)
    if (prediction?.status && prediction.status !== 'succeeded') {
      const id = prediction.id;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1200));
        const poll = await axios.get(`https://api.replicate.com/v1/predictions/${id}`, {
          headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` }
        });
        prediction = poll.data;
        if (prediction.status === 'succeeded') break;
        if (prediction.status === 'failed') {
          console.error('Prediction failed:', prediction);
          return res.status(500).json({ error: 'Model prediction failed', detail: prediction });
        }
      }
    }

    // Extract text from prediction.output
    let out = null;
    if (prediction.output) {
      if (Array.isArray(prediction.output)) out = prediction.output.join('\n');
      else if (typeof prediction.output === 'string') out = prediction.output;
      else out = JSON.stringify(prediction.output);
    } else {
      out = JSON.stringify(prediction);
    }

    return res.json({ reply: out, source: 'replicate' });

  } catch (err) {
    console.error('Server error:', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Server error', detail: err?.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Turon proxy alive'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
