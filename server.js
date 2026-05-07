require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════ CONFIG ══════════════════════════

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Lỗi đọc file config:', err);
  }
  return {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  };
}

function saveConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  } catch (err) {
    console.error('Lỗi lưu file config:', err);
  }
}

let config = loadConfig();

// ══════════════════════════ OPENAI SYSTEM PROMPT ══════════════════════════

const OPENAI_SYSTEM_PROMPT = `You are a world-class cinematic video director, motion designer, and creative storyteller.
Your task is to transform any topic into a deeply engaging, visually rich video script.

You MUST return a JSON object with this EXACT structure:
{
  "global_style_prompt": "A highly detailed description of the overarching visual style, color palette, lighting, mood, and main character/element appearance to maintain absolute visual consistency across all frames. Be extremely specific about colors (#hex), textures, camera angles, and art style.",
  "videoTitle": "Catchy, emotionally charged title",
  "style": "cinematic | educational | promotional | documentary | motivational | thriller | inspirational",
  "totalDuration": <total seconds>,
  "globalTheme": {
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "mood": "intense | calm | playful | mysterious | energetic | nostalgic | urgent",
    "fontStyle": "bold-impact | elegant-serif | techy-mono | handwritten | condensed-dramatic",
    "transitionStyle": "cut | crossfade | whip-pan | glitch-wipe | dissolve | zoom-wipe"
  },
  "scenes": [
    {
      "frame_number": 1,
      "id": 1,
      "sceneTitle": "MAX 5 WORDS",
      "action": "Specific, detailed visual description of what is happening on screen. Describe objects, movements, colors, composition.",
      "narration": "Natural speech. 2-5 sentences. Emotional, memorable.",
      "estimatedDuration": 10,
      "renderMode": "2d | 3d | handdrawn | whiteboard | particle | liquid | glitch | mixed",
      "background": {
        "type": "gradient | mesh-gradient | animated-particles | noise-field | solid | grid | aurora",
        "theme": "tech | space | nature | abstract | corporate | minimal | dark-cyber | warm-analog",
        "colors": ["#hex1", "#hex2"],
        "animated": true
      },
      "headlineText": "BIG text on screen",
      "subText": "Supporting line or null",
      "textAnimation": "typewriter | word-by-word | char-scatter | liquid-fill | glitch-reveal | split-reveal | magnetic-snap",
      "visualElements": [],
      "camera": { "motion": "static | dolly-in | pan-left | shake", "speed": "slow | medium | fast", "fov": 60 },
      "overlayEffects": ["vignette", "particles-float"],
      "accentColor": "#hexcolor",
      "hookType": "none"
    }
  ]
}

RULES:
- 5-9 scenes. Scene 1 MUST have a strong hookType (not "none").
- Each narration: 8-18 seconds when spoken.
- Vary renderMode, accentColor, and overlayEffects across scenes.
- The "action" field must be visually specific enough for an image generation AI.
- Match the language of the user's request.`;

// ══════════════════════════ CONSTANTS ══════════════════════════

const INTER_SCENE_DELAY = 3000; // 3s delay between Gemini calls
const MAX_FRAME_RETRIES = 3;    // Max retries per frame on 429/500
const RETRY_WAIT = 5000;        // 5s wait on rate limit

// ══════════════════════════ HELPER: SSE SENDER ══════════════════════════

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ══════════════════════════ HELPER: DELAY ══════════════════════════

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════ HELPER: GEMINI CALL WITH RETRY ══════════════════════════

async function callGeminiWithRetry(prompt, seed, retries = MAX_FRAME_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${config.geminiApiKey}`,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            seed: seed,
          },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 429 || status === 500 || status === 503;
      if (isRetryable && attempt < retries) {
        await delay(RETRY_WAIT);
        continue;
      }
      throw err;
    }
  }
}

// ══════════════════════════ ROUTES: CONFIG ══════════════════════════

app.post('/api/config', (req, res) => {
  const { geminiApiKey, elevenLabsApiKey, elevenLabsVoiceId } = req.body;
  if (geminiApiKey !== undefined) config.geminiApiKey = geminiApiKey;
  if (elevenLabsApiKey !== undefined) config.elevenLabsApiKey = elevenLabsApiKey;
  if (elevenLabsVoiceId !== undefined) config.elevenLabsVoiceId = elevenLabsVoiceId;
  saveConfig(config);
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  res.json({
    hasGeminiKey: !!config.geminiApiKey,
    hasElevenLabsKey: !!config.elevenLabsApiKey,
    hasGroqKey: !!process.env.GROQ_API_KEY,
    elevenLabsVoiceId: config.elevenLabsVoiceId,
    geminiKeyPreview: config.geminiApiKey ? config.geminiApiKey.slice(0, 8) + '...' : '',
  });
});

// ══════════════════════════ ROUTE: SSE GENERATE STREAM ══════════════════════════

app.get('/api/generate-stream', async (req, res) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const prompt = req.query.prompt;
  const animStyle = req.query.animStyle || 'ai';
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    sendSSE(res, 'error', { message: 'Groq API key chưa được cấu hình trong .env' });
    res.end();
    return;
  }
  if (!prompt) {
    sendSSE(res, 'error', { message: 'Vui lòng nhập nội dung video.' });
    res.end();
    return;
  }

  // Generate a fixed seed for visual consistency across this session
  const sessionSeed = Math.floor(Math.random() * 2147483647);

  try {
    // ── PHASE 1: Groq Director generates the script ──────────────────────
    sendSSE(res, 'progress', { phase: 'script', pct: 5, label: '🎬 Đang gọi Groq Director...' });

    let userPrompt = prompt;
    if (animStyle && animStyle !== 'ai') {
      userPrompt += `\n\nOverride: force textAnimation = '${animStyle}' for ALL scenes.`;
    }

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: OPENAI_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
      },
      {
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const rawContent = groqResponse.data.choices?.[0]?.message?.content || '';
    let scriptData;
    try {
      scriptData = JSON.parse(rawContent);
    } catch (parseErr) {
      sendSSE(res, 'error', { message: 'Groq trả về JSON không hợp lệ: ' + rawContent.slice(0, 200) });
      res.end();
      return;
    }

    sendSSE(res, 'script', { script: scriptData });
    sendSSE(res, 'progress', { phase: 'script', pct: 15, label: '✅ Kịch bản hoàn tất! Đang chuẩn bị rendering...' });

    // ── PHASE 2: Sequential Gemini Visual Enhancement ──────────────────────
    const scenes = scriptData.scenes || [];
    const globalStylePrompt = scriptData.global_style_prompt || '';
    const totalScenes = scenes.length;

    if (!config.geminiApiKey) {
      sendSSE(res, 'progress', { phase: 'visual', pct: 100, label: '⚠️ Gemini API key chưa cấu hình — bỏ qua visual enhancement.' });
      sendSSE(res, 'complete', { script: scriptData });
      res.end();
      return;
    }

    for (let i = 0; i < totalScenes; i++) {
      const scene = scenes[i];
      const frameNum = scene.frame_number || (i + 1);
      const basePct = 15 + ((i / totalScenes) * 80); // 15% to 95%

      sendSSE(res, 'progress', {
        phase: 'visual',
        pct: Math.round(basePct),
        label: `🎨 Đang xử lý cảnh ${frameNum}/${totalScenes}: "${scene.sceneTitle}"`,
        sceneIndex: i,
      });

      // Concatenate global style with scene action for visual consistency
      const visualPrompt = `Global Visual Style: ${globalStylePrompt}\n\nScene ${frameNum} Action: ${scene.action}\n\nGenerate a vivid, detailed visual description for this frame that stays consistent with the global style. Describe colors, lighting, composition, and movement.`;

      try {
        const visualDescription = await callGeminiWithRetry(visualPrompt, sessionSeed);
        scene.geminiVisualDescription = visualDescription;
        sendSSE(res, 'scene-ready', { sceneIndex: i, scene: scene });
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        sendSSE(res, 'scene-error', { sceneIndex: i, error: errMsg });
        // Continue — don't abort the whole pipeline for one frame
      }

      // Mandatory delay between Gemini calls (rate limit protection)
      if (i < totalScenes - 1) {
        await delay(INTER_SCENE_DELAY);
      }
    }

    sendSSE(res, 'progress', { phase: 'done', pct: 100, label: '✅ Hoàn tất! Đang bắt đầu render video...' });
    sendSSE(res, 'complete', { script: scriptData });

  } catch (err) {
    console.error('SSE Pipeline error:', err.response?.data || err.message);
    const errorMsg = err.response?.data?.error?.message || err.message;
    sendSSE(res, 'error', { message: errorMsg });
  }

  res.end();
});

// ══════════════════════════ LEGACY ROUTE: GENERATE SCRIPT (kept for backward compat) ══════════════════════════

app.post('/api/generate-script', async (req, res) => {
  const { prompt, animStyle } = req.body;
  const groqKey = process.env.GROQ_API_KEY;

  // Try Groq first, fallback to Gemini
  if (groqKey) {
    try {
      let userPrompt = prompt;
      if (animStyle && animStyle !== 'ai') {
        userPrompt += `\n\nOverride: force textAnimation = '${animStyle}' for ALL scenes.`;
      }

      const groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          response_format: { type: "json_object" },
          messages: [
            { role: 'system', content: OPENAI_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 4096,
        },
        {
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const rawContent = groqResponse.data.choices?.[0]?.message?.content || '';
      const scriptData = JSON.parse(rawContent);
      return res.json({ success: true, script: scriptData });
    } catch (err) {
      console.error('Groq fallback error:', err.response?.data || err.message);
      // Fall through to Gemini
    }
  }

  // Gemini fallback
  if (!config.geminiApiKey) {
    return res.status(400).json({ error: 'Chưa cấu hình API key (Groq hoặc Gemini).' });
  }
  if (!prompt) {
    return res.status(400).json({ error: 'Vui lòng nhập nội dung video.' });
  }

  let finalPrompt = prompt;
  if (animStyle && animStyle !== 'ai') {
    finalPrompt += `\n\nOverride rule: force textAnimation = '${animStyle}' for ALL scenes.`;
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${config.geminiApiKey}`,
      {
        system_instruction: { parts: [{ text: OPENAI_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
          response_mime_type: 'application/json',
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let scriptData;
    try {
      scriptData = JSON.parse(text);
    } catch (parseErr) {
      let cleanedText = text.replace(/,\s*([\]}])/g, '$1');
      const match = cleanedText.match(/\{[\s\S]*\}/);
      if (match) {
        scriptData = JSON.parse(match[0]);
      } else {
        throw new Error('Không thể phân tích JSON từ Gemini: ' + text.slice(0, 200));
      }
    }

    res.json({ success: true, script: scriptData });
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ══════════════════════════ ROUTES: TTS ══════════════════════════

app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const vid = voiceId || config.elevenLabsVoiceId;

  if (!config.elevenLabsApiKey) {
    return res.json({ success: false, useFallback: true, reason: 'no_api_key' });
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      },
      {
        headers: {
          'xi-api-key': config.elevenLabsApiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      }
    );

    const base64 = Buffer.from(response.data).toString('base64');
    res.json({ success: true, audio: base64, mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('ElevenLabs error:', err.response?.status, err.message);
    res.json({ success: false, useFallback: true, reason: err.message });
  }
});

app.get('/api/voices', async (req, res) => {
  if (!config.elevenLabsApiKey) return res.json({ voices: [] });
  try {
    const r = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': config.elevenLabsApiKey },
    });
    const filtered = r.data.voices.filter(v => {
      const name = v.name.toLowerCase();
      const labels = JSON.stringify(v.labels || {}).toLowerCase();
      return name.includes('viet') || labels.includes('viet');
    });
    res.json({ voices: (filtered.length > 0 ? filtered : r.data.voices).slice(0, 20) });
  } catch {
    res.json({ voices: [] });
  }
});

app.get('/api/tts-free', async (req, res) => {
  const { text, tl } = req.query;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const ALLOWED_LANGS = new Set([
    'vi', 'en', 'en-us', 'en-gb', 'en-au',
    'zh-CN', 'zh-TW', 'ja', 'ko', 'th', 'id', 'ms', 'hi',
    'fr', 'de', 'es', 'it', 'pt', 'ru', 'nl', 'pl', 'tr', 'ar',
  ]);
  const lang = ALLOWED_LANGS.has(tl) ? tl : 'vi';

  try {
    const MAX_CHARS = 200;
    const chunks = [];

    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHARS) {
        chunks.push(remaining);
        break;
      }
      let chunk = remaining.substring(0, MAX_CHARS);
      let lastSpace = chunk.lastIndexOf(' ');
      let lastPunct = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf(','), chunk.lastIndexOf('?'), chunk.lastIndexOf('!'));
      let splitAt = lastPunct > MAX_CHARS * 0.5 ? lastPunct + 1 : (lastSpace > 0 ? lastSpace : MAX_CHARS);
      chunks.push(remaining.substring(0, splitAt).trim());
      remaining = remaining.substring(splitAt).trim();
    }

    const audioBuffers = [];
    for (const chunk of chunks) {
      if (!chunk) continue;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      audioBuffers.push(response.data);
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    res.set('Content-Type', 'audio/mpeg');
    res.send(finalBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch free TTS' });
  }
});

// ══════════════════════════ SERVE FRONTEND ══════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════ START ══════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 TuanDevTop đang chạy tại: http://localhost:${PORT}\n`);
});
