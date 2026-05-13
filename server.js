require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { google } = require('googleapis');
const session = require('express-session');
const multer = require('multer');
const { Readable } = require('stream');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for complex scripts
app.use(express.raw({ type: 'video/*', limit: '2gb' }));

// Global error handlers to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'minusai-yt-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,       // set true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

const tts = new MsEdgeTTS();

/**
 * Robust JSON extraction from AI text
 */
function extractJSON(text) {
  try {
    // 1. Direct parse attempt
    return JSON.parse(text);
  } catch (e) {
    // 2. Extract from markdown blocks or braces
    try {
      const cleaned = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
      const start = cleaned.indexOf('{');
      if (start === -1) throw e;
      const content = cleaned.substring(start);
      
      // Try to find the last valid }
      let lastEnd = content.lastIndexOf('}');
      while (lastEnd !== -1) {
        try {
          const attempt = content.substring(0, lastEnd + 1).replace(/,\s*([\]}])/g, '$1');
          return JSON.parse(attempt);
        } catch (innerE) {
          lastEnd = content.lastIndexOf('}', lastEnd - 1);
        }
      }
      throw e;
    } catch (finalE) {
      throw finalE;
    }
  }
}

// Extract keys from request headers or fallback to environment variables
function getGeminiKey(req) {
  return req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
}
function getJinaKey(req) {
  return req.headers['x-jina-key'] || process.env.JINA_API_KEY;
}

// ─── QUOTA ENDPOINT ──────────────────────────────────────────────────────────
app.get('/api/quota', async (req, res) => {
  const geminiKey = getGeminiKey(req);
  const jinaKey = getJinaKey(req);
  
  const results = {
    gemini: { status: 'Unknown', usage: null, error: null },
    jina: { status: 'Unknown', usage: null, error: null }
  };

  // 1. Check Jina AI Quota (No direct usage API, so we check status/headers)
  if (jinaKey) {
    try {
      // Small HEAD request to check key validity
      const response = await axios.get('https://r.jina.ai/https://example.com', {
        headers: { 'Authorization': `Bearer ${jinaKey}`, 'X-No-Cache': 'true' },
        maxContentLength: 1, 
        validateStatus: () => true,
        timeout: 10000 // 10s
      });
      
      if (response.status >= 200 && response.status < 300) {
        results.jina.status = 'Active';
        results.jina.usage = {
          remaining: response.headers['x-ratelimit-remaining-requests'] || 'Check Dashboard',
          info: 'Jina AI does not provide a direct wallet balance API. Check the dashboard for full details.'
        };
      } else if (response.status === 401 || response.status === 403) {
        results.jina.status = 'Invalid Key';
      } else {
        results.jina.status = 'Error';
        results.jina.error = `HTTP ${response.status}: ${response.data?.message || 'Unknown error'}`;
      }
    } catch (e) {
      results.jina.status = 'Error';
      results.jina.error = e.message;
    }
  } else {
    results.jina.status = 'Missing Key';
  }

  // 2. Check Gemini Key
  if (geminiKey) {
    try {
      await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`, {
        contents: [{ parts: [{ text: 'hi' }] }]
      }, { timeout: 80000 });
      results.gemini.status = 'Active';
      results.gemini.usage = { info: 'API Key is valid. Google does not provide a direct per-key quota API.' };
    } catch (e) {
      results.gemini.status = 'Error';
      results.gemini.error = e.response?.data?.error?.message || e.message;
    }
  } else {
    results.gemini.status = 'Missing Key';
  }

  res.json(results);
});

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
const VIDEO_SYSTEM_PROMPT = `You are an elite video script director and creative storyteller. Your task is to transform any topic into a professional, cinematic video script in strict JSON format.

OUTPUT RULES (CRITICAL):
- Respond with ONLY valid JSON. No markdown code blocks, no explanation, no text before or after.
- The JSON must be parseable by JSON.parse() directly.

JSON STRUCTURE:
{
  "videoTitle": "Catchy, compelling title of the entire video",
  "style": "cinematic | educational | promotional | documentary | motivational",
  "totalDuration": estimated_total_seconds_as_number,
  "scenes": [
    {
      "id": 1,
      "sceneTitle": "SHORT TITLE (MAX 5 WORDS)",
      "textContent": "Short descriptive text displayed on screen, max 15-20 words. High-level summary of the scene's point.",
      "narration": "Full narration spoken aloud. Write as natural speech, 2-5 sentences. This is what the AI voice will say.",
      "accentColor": "#hexcolor",
      "animationStyle": "slide-up | slide-left | zoom-in | fade-in | typewriter",
      "backgroundTheme": "tech | nature | abstract | space | corporate | minimal",
      "imagePrompt": "A highly descriptive, English prompt describing the scene visually. Used for AI image generation. Max 15 words.",
      "estimatedDuration": seconds_number
    }
  ]
}

CREATIVE RULES:
- imagePrompt: Create visually striking, photorealistic image prompts relevant to the textContent. Use English even if the narration is in another language. Max 15 words. MUST be included for EVERY scene.
- sceneTitle: MAXIMUM 5 WORDS. Short, punchy, powerful. This is displayed BIG on screen.
- textContent: 10-20 words summary. Engaging text that complements narration but doesn't duplicate it word-for-word.
- narration: Natural conversational speech. 2-5 sentences. 8-20 seconds when spoken aloud.
- Create 5-9 scenes for a complete, well-paced video
- Scene 1: Hook / Introduction (grab attention)
- Middle scenes: Core content, each covering one key idea
- Last scene: Conclusion, summary, or call-to-action
- Vary accentColors across scenes for visual variety. Use vibrant colors: #00d4ff, #7c3aed, #10b981, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #84cc16
- Vary animationStyles for dynamic feel
- estimatedDuration: 8-18 seconds per scene
- Make narration engaging, emotional, and memorable - NOT dry or corporate

LANGUAGE: Match the language of the user's request (Vietnamese if asked in Vietnamese, English if in English, etc.)`;

const DATA_STORYTELLING_RULES = `
[DATA STORYTELLING DIRECTIVE — MANDATORY FOR NEWS AND ARTICLE SCRIPTS]
Your job is not just to summarize. You must also be a DATA JOURNALIST.

STEP 1 — MINE THE DATA:
Scan the entire source material for every quantitative fact: percentages, dollar amounts, user counts, growth rates, timelines, rankings, temperature readings, death tolls, market caps — anything numeric.

STEP 2 — SELECT THE SHOCKING 3:
From all numbers found, select exactly 3 that are most likely to make the viewer stop scrolling. Prioritize:
- The largest or smallest number (record-breaking scale)
- The sharpest change (biggest % increase/decrease)
- The most emotionally resonant number (human cost, milestone, comparison)
If fewer than 3 strong numbers exist in the source, use only what is real — do NOT invent statistics.

STEP 3 — ASSIGN TO SCENES:
Embed each chosen number into a DIFFERENT scene as a visual element.
- FORBIDDEN scenes: Scene 1 (the Hook) and the LAST scene (the CTA/Conclusion)
- Each data scene gets EXACTLY 1 visual element — never more
- The narration of that scene must reference and explain the number
- The "sceneTitle" of that scene must tease the number (e.g., "3.2 Tỷ Người Bị Ảnh Hưởng")

STEP 4 — CHOOSE THE RIGHT ELEMENT TYPE:
- Single isolated number → "stat-counter" with prefix/suffix
- Percentage, completion rate, proportion → "progress-bar"
- Trend over time (3+ time periods) or comparison (3+ categories) → "chart" with chartType "bar" or "line"

STEP 5 — POSITION RULE:
- Every element uses "bottom-left" (only 1 element per scene, so no conflict)

STEP 6 — ELEMENT SCHEMA:
stat-counter:
{
  "type": "stat-counter",
  "label": "Short label in the video language (max 4 words)",
  "value": <raw_number_no_commas>,
  "prefix": "$" or "" or "+" etc.,
  "suffix": "%" or "K" or "M" or "B" or " người" etc.,
  "position": "bottom-left"
}
progress-bar:
{
  "type": "progress-bar",
  "label": "Short label (max 4 words)",
  "percent": <0-100>,
  "position": "bottom-left"
}
chart (bar or line):
{
  "type": "chart",
  "chartType": "bar" | "line",
  "label": "Chart title (max 6 words)",
  "data": [
    { "label": "Q1", "value": 120 },
    { "label": "Q2", "value": 340 }
  ],
  "position": "bottom-left"
}
CRITICAL: value must always be a raw JavaScript number. Never use strings like "4.2 tỷ" — use 4200000000. Never use commas inside numbers.
`;

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Generate script with Gemini
app.post('/api/generate-script', async (req, res) => {
  const { prompt } = req.body;
  const geminiKey = getGeminiKey(req);
  if (!geminiKey) return res.status(401).json({ error: 'Gemini API key is missing. Please configure it in settings.' });
  if (!prompt) return res.status(400).json({ error: 'Vui lòng nhập nội dung video.' });

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        system_instruction: { parts: [{ text: VIDEO_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          response_mime_type: 'application/json',
        },
      },
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 80000 // 80s
      }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let scriptData;
    try {
      scriptData = extractJSON(text);
    } catch (parseErr) {
      console.error("Gemini error: Không thể phân tích JSON từ Gemini:", text);
      return res.status(500).json({ error: 'AI trả về định dạng kịch bản không hợp lệ. Vui lòng thử lại.' });
    }

    res.json({ success: true, script: { ...scriptData, _articleMedia: { thumbnail: null, videoUrl: null, youtubeId: null } } });
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Generate TTS with Edge-TTS (Keyless & Free)
app.post('/api/tts', async (req, res) => {
  const { text, voiceId, voiceStyle } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  // Use requested voice or default to Vietnamese neural
  const vid = voiceId || 'vi-VN-HoaiMyNeural';

  // ── Edge-TTS (Free) ──
  try {
    const generateAudio = () => new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Edge-TTS request timed out (20s)')), 80000);
      
      try {
        const parts = vid.split('-');
        const locale = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'vi-VN';

        // Prosody presets
        const STYLE_PRESETS = {
          'default':     { rate: '+0%',   pitch: '+0Hz',  volume: '+0%'  },
          'slow':        { rate: '-30%',  pitch: '-2Hz',  volume: '+0%'  },
          'fast':        { rate: '+30%',  pitch: '+0Hz',  volume: '+0%'  },
          'serious':     { rate: '-10%',  pitch: '-8Hz',  volume: '+5%'  },
          'energetic':   { rate: '+20%',  pitch: '+8Hz',  volume: '+10%' },
          'calm':        { rate: '-15%',  pitch: '-4Hz',  volume: '-5%'  },
          'cheerful':    { rate: '+10%',  pitch: '+6Hz',  volume: '+5%'  },
          'documentary': { rate: '-5%',   pitch: '-3Hz',  volume: '+0%'  },
          'news':        { rate: '+5%',   pitch: '+2Hz',  volume: '+8%'  },
        };

        const style = voiceStyle || 'default';
        const prosody = STYLE_PRESETS[style] || STYLE_PRESETS['default'];

        // Fresh instance to avoid readyState issues on shared instance
        const localTts = new MsEdgeTTS();
        await localTts.setMetadata(vid, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, locale);
        
        const { audioStream } = localTts.toStream(text, {
          rate: prosody.rate,
          pitch: prosody.pitch,
          volume: prosody.volume,
        });
        
        if (!audioStream) {
          throw new Error('Edge-TTS không thể khởi tạo luồng âm thanh.');
        }

        const chunks = [];
        audioStream.on('data', (chunk) => chunks.push(chunk));
        audioStream.on('end', () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks));
        });
        audioStream.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });

    const audioBuffer = await generateAudio();
    res.json({ success: true, audio: audioBuffer.toString('base64'), mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('Edge-TTS error:', err.message);
    res.json({ success: false, useFallback: true, reason: err.message });
  }
});

// Get Edge-TTS voices
app.get('/api/voices', async (req, res) => {
  // Curated Edge TTS voice list — grouped by language and use case
  const EDGE_VOICES = [

    // ── Vietnamese ───────────────────────────────────────────────────────
    { voice_id: 'vi-VN-HoaiMyNeural',   name: '🇻🇳 Hoài My — Nữ (Thân thiện)',     lang: 'vi', gender: 'female' },
    { voice_id: 'vi-VN-NamMinhNeural',  name: '🇻🇳 Nam Minh — Nam (Thân thiện)',    lang: 'vi', gender: 'male'   },

    // ── English (US) ─────────────────────────────────────────────────────
    { voice_id: 'en-US-AriaNeural',        name: '🇺🇸 Aria — Female (Positive, Confident)',  lang: 'en', gender: 'female' },
    { voice_id: 'en-US-JennyNeural',       name: '🇺🇸 Jenny — Female (Friendly, Assistant)', lang: 'en', gender: 'female' },
    { voice_id: 'en-US-SaraNeural',        name: '🇺🇸 Sara — Female (Cheerful)',              lang: 'en', gender: 'female' },
    { voice_id: 'en-US-ChristopherNeural', name: '🇺🇸 Christopher — Male (Reliable)',         lang: 'en', gender: 'male'   },
    { voice_id: 'en-US-EricNeural',        name: '🇺🇸 Eric — Male (Rational)',                lang: 'en', gender: 'male'   },
    { voice_id: 'en-US-GuyNeural',         name: '🇺🇸 Guy — Male (Passionate)',               lang: 'en', gender: 'male'   },
    { voice_id: 'en-US-TonyNeural',        name: '🇺🇸 Tony — Male (Confident)',               lang: 'en', gender: 'male'   },
    { voice_id: 'en-US-DavisNeural',       name: '🇺🇸 Davis — Male (Casual)',                 lang: 'en', gender: 'male'   },

    // ── English (UK) ─────────────────────────────────────────────────────
    { voice_id: 'en-GB-SoniaNeural',    name: '🇬🇧 Sonia — Female (Bright)',        lang: 'en-GB', gender: 'female' },
    { voice_id: 'en-GB-RyanNeural',     name: '🇬🇧 Ryan — Male (Calm)',             lang: 'en-GB', gender: 'male'   },

    // ── Chinese ──────────────────────────────────────────────────────────
    { voice_id: 'zh-CN-XiaoxiaoNeural', name: '🇨🇳 Xiaoxiao — 女 (温暖)',          lang: 'zh', gender: 'female' },
    { voice_id: 'zh-CN-YunxiNeural',    name: '🇨🇳 Yunxi — 男 (阳光)',             lang: 'zh', gender: 'male'   },
    { voice_id: 'zh-CN-YunyangNeural',  name: '🇨🇳 Yunyang — 男 (专业新聞)',       lang: 'zh', gender: 'male'   },

    // ── Japanese ─────────────────────────────────────────────────────────
    { voice_id: 'ja-JP-NanamiNeural',   name: '🇯🇵 Nanami — 女性 (Friendly)',      lang: 'ja', gender: 'female' },
    { voice_id: 'ja-JP-KeitaNeural',    name: '🇯🇵 Keita — 男性 (Friendly)',       lang: 'ja', gender: 'male'   },

    // ── Korean ───────────────────────────────────────────────────────────
    { voice_id: 'ko-KR-SunHiNeural',    name: '🇰🇷 Sun-Hi — 여성 (Friendly)',      lang: 'ko', gender: 'female' },
    { voice_id: 'ko-KR-InJoonNeural',   name: '🇰🇷 InJoon — 남성 (Friendly)',      lang: 'ko', gender: 'male'   },
  ];

  res.json({ voices: EDGE_VOICES });
});

// Generate Free TTS (Google Translate Proxy)
app.post('/api/tts-free', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

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
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=vi&client=tw-ob`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      // Check if response is actually audio
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('audio')) {
        throw new Error('Google TTS blocked request (CAPTCHA or Rate Limit)');
      }
      
      audioBuffers.push(response.data);
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    res.set('Content-Type', 'audio/mpeg');
    res.send(finalBuffer);
  } catch (err) {
    console.error('Free TTS Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch free TTS: ' + err.message });
  }
});

// Proxy for AI Images to avoid CORS and SecurityError in WebCodecs
app.get('/api/scene-image', async (req, res) => {
  const { prompt } = req.query;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const maxRetries = 3; // Increase to 3 retries
  const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

  for (let i = 0; i <= maxRetries; i++) {
    try {
      // Increase delay between retries: 3s, 6s, 9s
      if (i > 0) await new Promise(r => setTimeout(r, 3000 * i)); 

      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000 // Reduced to 60s - 120s is often too long for browser/proxy
      });

      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(response.data);
    } catch (err) {
      console.warn(`Image Proxy Attempt ${i + 1} failed for prompt: "${prompt.substring(0, 30)}..." - Error: ${err.message}`);
      if (i === maxRetries) {
        res.set('Content-Type', 'image/gif');
        return res.send(transparentPixel);
      }
    }
  }
});

// ── News Hunter Pipeline ───────────────────────────────────────────────────
app.post('/api/news-to-video', async (req, res) => {
  const { topic } = req.body;
  const geminiKey = getGeminiKey(req);
  const jinaKey = getJinaKey(req);

  if (!topic) return res.status(400).json({ error: 'Vui lòng nhập chủ đề tin tức.' });
  if (!geminiKey) return res.status(401).json({ error: 'Thiếu Gemini API key.' });
  if (!jinaKey) return res.status(401).json({ error: 'Thiếu Jina API key. Vui lòng cấu hình trong .env hoặc cài đặt.' });

  try {
    // 1. Search for news using Jina Search
    const searchResponse = await axios.get(`https://s.jina.ai/${encodeURIComponent(topic)}`, {
      headers: { 'Authorization': `Bearer ${jinaKey}` },
      timeout: 30000 
    });

    // Truncate search results to first 15000 chars to stay within reasonable limits
    const searchResults = (searchResponse.data || "").substring(0, 15000);
    
    const newsPrompt = `
    [ROLE]: You are an elite TV News Producer and a Breaking News Anchor. 
    
    [SOURCE MATERIAL]:
    TOPIC: "${topic}"
    SEARCH DATA:
    ${searchResults}

    [OBJECTIVE]:
    Transform the SEARCH DATA into a professional news broadcast script. 
    1. EXTRACTION: Identify the "5 Ws" (Who, What, When, Where, Why) and prioritize the most impactful numbers, statistics, or quotes.
    2. NARRATIVE ARC:
       - Scene 1: THE HOOK. Announce the breaking news and grab attention.
       - Middle Scenes: Deliver the core evidence, data points, and context.
       - Final Scene: THE IMPACT. Conclude with the significance of the story or "What to watch for next".

    [STRICT WRITING & DIRECTING RULES]:
    - SCENE COUNT: Based on the depth of the SEARCH DATA, create a comprehensive script. MINIMUM 5 SCENES. Let the story dictate the length.
    - FALLBACK MECHANISM: If the SEARCH DATA is completely empty, irrelevant, or contains only code/errors, output a 1-scene JSON apologizing that no recent breaking news was found for this topic. Do NOT invent facts.
    - TONE ADAPTATION: Analyze the sentiment of the news. If it is a tragedy or disaster, use a solemn, respectful, and serious tone. If it is tech/entertainment, use an energetic, high-octane tone.
    - VISUAL DIRECTING: For news videos, heavily favor "corporate", "tech", or "minimal" for "backgroundTheme". Use "slide-left" or "fade-in" for "animationStyle" to mimic TV news graphics. Choose "accentColor" wisely (e.g., #ef4444 Red for breaking news, #00d4ff Blue for tech/finance).
    - LANGUAGE: Detect the language of the TOPIC "${topic}". You MUST write the entire JSON response natively in that detected language.
    - DATA: Follow the DATA STORYTELLING DIRECTIVE below to embed up to 3 real statistics as visual elements.
    - "textContent": Write this as a "Lower-Third News Ticker". It must be a punchy, authoritative summary of the current scene's main fact. ABSOLUTE MAXIMUM 15 TO 30 WORDS.
    - "narration": Write this for a professional news anchor reading from a teleprompter. Pacing should be 2-5 engaging sentences.
    - "imagePrompt": Create visually striking, photorealistic image prompts relevant to the textContent. Use English even if the narration is in another language. Max 15 words. This field is MANDATORY for every scene.
    ${req.body.orientation === 'portrait' ? '- PORTRAIT MODE: This is for TikTok/Shorts. Keep "sceneTitle" to max 4 words. Focus on center-weighted visuals.' : ''}

    [OUTPUT]:
    Provide ONLY the valid JSON object following the VIDEO_SYSTEM_PROMPT schema.
    ${DATA_STORYTELLING_RULES}
    `;

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        system_instruction: { parts: [{ text: VIDEO_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: newsPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          response_mime_type: "application/json"
        }
      },
      { timeout: 45000 }
    );

    let text = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      throw new Error('Gemini did not return any content (possibly safety filtered).');
    }

    // Clean JSON string
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const scriptData = JSON.parse(text);

      // ── Data Storytelling validation ───────────────────────────────────────
      if (scriptData.scenes && Array.isArray(scriptData.scenes)) {
        const total = scriptData.scenes.length;
        scriptData.scenes.forEach((scene, idx) => {
          // Enforce: no element on scene 0 (hook) or last scene (CTA)
          if ((idx === 0 || idx === total - 1) && scene.elements?.length > 0) {
            console.warn(`[DataStorytelling] Removed elements from scene ${idx + 1} (hook/CTA rule)`);
            scene.elements = [];
          }
          // Enforce: max 1 element per scene
          if (scene.elements?.length > 1) {
            console.warn(`[DataStorytelling] Capped elements on scene ${idx + 1} to 1`);
            scene.elements = [scene.elements[0]];
          }
          // Enforce: position must be bottom-left for single-element scenes
          if (scene.elements?.length === 1) {
            scene.elements[0].position = 'bottom-left';
          }
          // Enforce: value must be a number
          if (scene.elements?.[0]?.type === 'stat-counter') {
            scene.elements[0].value = Number(scene.elements[0].value) || 0;
          }
          // Enforce: percent must be 0-100
          if (scene.elements?.[0]?.type === 'progress-bar') {
            scene.elements[0].percent = Math.min(100, Math.max(0, Number(scene.elements[0].percent) || 0));
          }
          // Enforce: chart data must be an array with at least 2 points
          if (scene.elements?.[0]?.type === 'chart') {
            if (!Array.isArray(scene.elements[0].data) || scene.elements[0].data.length < 2) {
              console.warn(`[DataStorytelling] Removed invalid chart from scene ${idx + 1}`);
              scene.elements = [];
            }
          }
        });
      }

      res.json({ ...scriptData, _articleMedia: { thumbnail: null, videoUrl: null, youtubeId: null } });
    } catch (parseErr) {
      console.error('JSON Parse Error:', text);
      throw new Error('Kịch bản AI trả về không đúng định dạng JSON.');
    }
  } catch (err) {
    console.error('News Hunter Error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    res.status(status).json({ 
      error: 'Lỗi săn tin: ' + (err.response?.data?.error?.message || err.message) 
    });
  }
});

// Article URL to Video Pipeline
app.post('/api/url-to-video', async (req, res) => {
  const { articleUrl } = req.body;
  const geminiKey = getGeminiKey(req);
  const jinaKey = getJinaKey(req);

  if (!articleUrl) return res.status(400).json({ error: 'Vui lòng cung cấp URL bài báo.' });
  if (!geminiKey) return res.status(401).json({ error: 'Thiếu Gemini API key.' });
  if (!jinaKey) return res.status(401).json({ error: 'Thiếu Jina API key.' });

  try {
    // 1. Validate URL
    try {
      new URL(articleUrl);
    } catch (e) {
      return res.status(400).json({ error: 'URL không hợp lệ. Vui lòng nhập link bắt đầu bằng http:// hoặc https://' });
    }

    // 2. Scrape article content (Markdown)
    const scrapeResponse = await axios.get(`https://r.jina.ai/${articleUrl}`, {
      headers: { 'Authorization': `Bearer ${jinaKey}` },
      timeout: 35000
    });

    const scrapedContent = (scrapeResponse.data || "").trim();

    // 3. Extract Metadata (Thumbnail & Videos) via HTML format
    let articleMedia = { thumbnail: null, videoUrl: null, youtubeId: null };
    try {
      const htmlResponse = await axios.get(`https://r.jina.ai/${articleUrl}`, {
        headers: { 
          'Authorization': `Bearer ${jinaKey}`,
          'X-Return-Format': 'html'
        },
        timeout: 15000
      });
      const html = htmlResponse.data || "";
      
      // Basic extraction via Regex to avoid heavy DOM parsers
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImageMatch) articleMedia.thumbnail = ogImageMatch[1];

      // Video extraction (YouTube or MP4)
      const ytMatch = html.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (ytMatch) {
        articleMedia.youtubeId = ytMatch[1];
      } else {
        const mp4Match = html.match(/<video[^>]*src=["']([^"']+\.mp4)["']/i) || 
                         html.match(/<source[^>]*src=["']([^"']+\.mp4)["'][^>]*type=["']video\/mp4["']/i);
        if (mp4Match) articleMedia.videoUrl = mp4Match[1];
      }
    } catch (metaErr) {
      console.warn("Metadata extraction failed (non-blocking):", metaErr.message);
    }

    // 4. Anti-Paywall / Content check
    if (scrapedContent.length < 200) {
      return res.status(400).json({ error: 'Nội dung bài báo quá ngắn hoặc không thể truy cập.' });
    }

    if (scrapedContent.includes("Enable JavaScript") || scrapedContent.includes("Log in to read")) {
      return res.status(400).json({ error: 'Không thể đọc được nội dung bài báo. Trang web này có thể yêu cầu đăng nhập hoặc chặn robot.' });
    }

    // Truncate to save context
    const truncatedContent = scrapedContent.substring(0, 15000);

    // 4. AI Script Generation
    const articlePrompt = `
  [ROLE]: You are an elite TV News Producer.
  [SOURCE MATERIAL]:
  ARTICLE URL: "${articleUrl}"
  ARTICLE CONTENT:
  ${truncatedContent}
  
  [OBJECTIVE & RULES]:
  Summarize this specific article into a video script. 
  Extract the 5 Ws (Who, What, When, Where, Why). 
  Adapt the number of scenes (minimum 3, maximum 6) based on the depth of the ARTICLE CONTENT. 
  If the content is extremely short, expand contextually using the article's core facts without hallucinating fake data.
  Follow all tone, formatting, and JSON rules from the system prompt.
  ${req.body.orientation === 'portrait' ? 'CRITICAL: This is for a PORTRAIT video. Keep "sceneTitle" extremely short (max 4 words).' : ''}
  ${DATA_STORYTELLING_RULES}
  `;

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        system_instruction: { parts: [{ text: VIDEO_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: articlePrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          response_mime_type: "application/json"
        }
      },
      { timeout: 45000 }
    );

    let text = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Gemini did not return content.');

    // Clean JSON string
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const scriptData = extractJSON(text);

      // ── Data Storytelling validation ───────────────────────────────────────
      if (scriptData.scenes && Array.isArray(scriptData.scenes)) {
        const total = scriptData.scenes.length;
        scriptData.scenes.forEach((scene, idx) => {
          // Wrap elements check in case it's missing or misspelled
          const elements = scene.element ? [scene.element] : (scene.elements || []);
          
          let validatedElements = [];
          if (elements.length > 0) {
             // Enforce: no element on scene 0 (hook) or last scene (CTA)
             if (idx !== 0 && idx !== total - 1) {
               const el = elements[0];
               if (el.type === 'stat-counter') el.value = Number(el.value) || 0;
               if (el.type === 'progress-bar') el.percent = Math.min(100, Math.max(0, Number(el.percent) || 0));
               el.position = 'bottom-left';
               validatedElements = [el];
             }
          }
          scene.elements = validatedElements;
          delete scene.element; // Cleanup
        });
      }

      res.json({ ...scriptData, _articleMedia: articleMedia });
    } catch (parseErr) {
      console.error('URL to Video Parse Error:', text);
      res.status(500).json({ error: 'Kịch bản AI không đúng định dạng JSON. Vui lòng thử lại.' });
    }

  } catch (err) {
    console.error('URL to Video Error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    res.status(status).json({ 
      error: 'Lỗi xử lý link bài báo: ' + (err.response?.data?.error?.message || err.message) 
    });
  }
});

// ── YouTube OAuth2 ───────────────────────────────────────────────────────────
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

// ── GET /api/youtube/auth-url — Generate OAuth consent screen URL ─────────
app.get('/api/youtube/auth-url', (req, res) => {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'   // force refresh_token to always be returned
  });
  res.json({ url });
});

// ── GET /api/youtube/callback — Handle OAuth redirect ─────────────────────
app.get('/api/youtube/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`<script>window.opener?.postMessage({type:'yt-auth-error',error:'${error}'},'*');window.close();</script>`);
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    // Store tokens in server session — never send to browser
    req.session.youtubeTokens = tokens;
    req.session.save();

    // Close popup and notify parent
    res.send(`<script>window.opener?.postMessage({type:'yt-auth-success'},'*');window.close();</script>`);
  } catch (err) {
    console.error('YouTube OAuth callback error:', err.message);
    res.send(`<script>window.opener?.postMessage({type:'yt-auth-error',error:'token_exchange_failed'},'*');window.close();</script>`);
  }
});

// ── GET /api/youtube/status — Check if user is authenticated ──────────────
app.get('/api/youtube/status', async (req, res) => {
  const tokens = req.session.youtubeTokens;
  if (!tokens) {
    return res.json({ authenticated: false });
  }

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Auto-refresh access token if expired
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({ part: 'snippet', mine: true });
    const channel = channelRes.data.items?.[0];

    // Save refreshed tokens
    req.session.youtubeTokens = oauth2Client.credentials;

    res.json({
      authenticated: true,
      channelName: channel?.snippet?.title || 'Your Channel',
      channelId: channel?.id
    });
  } catch (err) {
    // Token invalid — clear it
    req.session.youtubeTokens = null;
    res.json({ authenticated: false, reason: err.message });
  }
});

// ── GET /api/youtube/logout — Revoke and clear tokens ─────────────────────
app.get('/api/youtube/logout', async (req, res) => {
  const tokens = req.session.youtubeTokens;
  if (tokens?.access_token) {
    try {
      const oauth2Client = createOAuth2Client();
      await oauth2Client.revokeToken(tokens.access_token);
    } catch (_) { /* ignore revoke errors */ }
  }
  req.session.youtubeTokens = null;
  res.json({ success: true });
});

// ── POST /api/youtube/upload — Upload video to YouTube ────────────────────
app.post('/api/youtube/upload', async (req, res) => {
  const tokens = req.session.youtubeTokens;
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated with YouTube. Please connect your account first.' });
  }

  const { title, description, orientation, tags } = req.query;
  const videoBuffer = req.body; // raw video bytes from express.raw()

  if (!videoBuffer || videoBuffer.length === 0) {
    return res.status(400).json({ error: 'No video data received.' });
  }

  const isShorts = orientation === 'portrait';

  // Build title and description with Shorts hashtag if needed
  const videoTitle = isShorts
    ? `${decodeURIComponent(title || 'AI Video')} #Shorts`
    : decodeURIComponent(title || 'AI Video');

  const videoDescription = isShorts
    ? `${decodeURIComponent(description || '')} #Shorts #YouTubeShorts`
    : decodeURIComponent(description || 'Created with MinusAI');

  const videoTags = tags
    ? decodeURIComponent(tags).split(',').map(t => t.trim()).filter(Boolean)
    : ['AI', 'MinusAI'];

  if (isShorts) {
    videoTags.push('Shorts', 'YouTubeShorts');
  }

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Convert Buffer to Readable stream for YouTube API
    const videoStream = new Readable();
    videoStream.push(videoBuffer);
    videoStream.push(null);

    // Insert video with resumable upload
    const uploadResponse = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: videoTitle,
          description: videoDescription,
          tags: videoTags,
          categoryId: '22',  // People & Blogs
          defaultLanguage: 'vi',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        }
      },
      media: {
        mimeType: 'video/webm',
        body: videoStream,
      }
    }, {
      onUploadProgress: (event) => {
        const percent = Math.round((event.bytesRead / videoBuffer.length) * 100);
        console.log(`[YouTube Upload] ${percent}% — ${event.bytesRead}/${videoBuffer.length} bytes`);
      }
    });

    // Save refreshed tokens
    req.session.youtubeTokens = oauth2Client.credentials;

    const videoId = uploadResponse.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const shortsUrl = isShorts ? `https://www.youtube.com/shorts/${videoId}` : null;

    res.json({
      success: true,
      videoId,
      videoUrl,
      shortsUrl,
      title: videoTitle,
      isShorts
    });

  } catch (err) {
    console.error('YouTube upload error:', err.response?.data || err.message);
    const message = err.response?.data?.error?.message || err.message;
    res.status(500).json({ error: `YouTube upload failed: ${message}` });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎬 Tool đang chạy tại: http://localhost:${PORT}`);
});