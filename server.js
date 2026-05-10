require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const tts = new MsEdgeTTS();

// Extract keys from request headers or fallback to environment variables
function getGeminiKey(req) {
  return req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
}
// Note: Fish Audio integration removed. Using Microsoft Edge TTS exclusively for free TTS.

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
      { headers: { 'Content-Type': 'application/json' } }
    );

    let text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Strip markdown code blocks if present
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let scriptData;
    try {
      scriptData = JSON.parse(text);
    } catch (parseErr) {
      console.warn("Lỗi phân tích JSON gốc, đang thử dọn dẹp chuyên sâu...");
      try {
        const start = text.indexOf('{');
        if (start === -1) throw parseErr;
        let cleaned = text.substring(start);

        // Iteratively try to find the correct ending
        let success = false;
        let lastEnd = cleaned.lastIndexOf('}');
        while (lastEnd !== -1) {
          try {
            let attempt = cleaned.substring(0, lastEnd + 1);
            attempt = attempt.replace(/,\s*([\]}])/g, '$1');
            scriptData = JSON.parse(attempt);
            success = true;
            break;
          } catch (e) {
            lastEnd = cleaned.lastIndexOf('}', lastEnd - 1);
          }
        }
        if (!success) throw parseErr;
      } catch (finalErr) {
        console.error("Gemini error: Không thể phân tích JSON từ Gemini:", text);
        return res.status(500).json({ error: 'AI trả về định dạng kịch bản không hợp lệ. Vui lòng thử lại.' });
      }
    }

    res.json({ success: true, script: scriptData });
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
    // TC1: Handle long text / TC2: Network Timeout
    const generateAudio = () => new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Edge-TTS request timed out (15s)')), 15000);
      
      try {
        // Extract locale from voiceId (e.g., 'vi-VN-HoaiMyNeural' -> 'vi-VN')
        const parts = vid.split('-');
        const locale = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'vi-VN';

        // ── Resolve speaking style → prosody parameters ──────────────────────────
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

        const style = req.body.voiceStyle || 'default';
        const prosody = STYLE_PRESETS[style] || STYLE_PRESETS['default'];

        await tts.setMetadata(vid, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, locale);
        
        // Pass prosody options to the stream
        const { audioStream } = tts.toStream(text, {
          rate: prosody.rate,
          pitch: prosody.pitch,
          volume: prosody.volume,
        });
        
        if (!audioStream || typeof audioStream.on !== 'function') {
          throw new Error('Edge-TTS không thể khởi tạo luồng âm thanh (stream).');
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
    const base64 = audioBuffer.toString('base64');
    
    res.json({ success: true, audio: base64, mimeType: 'audio/mpeg' });
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
    { voice_id: 'zh-CN-YunyangNeural',  name: '🇨🇳 Yunyang — 男 (专业新闻)',       lang: 'zh', gender: 'male'   },

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
app.get('/api/tts-free', async (req, res) => {
  const { text } = req.query;
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
        timeout: 120000 // 2 minutes timeout as requested
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

function getJinaKey(req) {
  return req.headers['x-jina-key'] || process.env.JINA_API_KEY;
}

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
      timeout: 30000 // Tăng lên 30s vì Jina Search có thể cần thời gian để crawl nhiều nguồn tin mới nhất
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
    - VISUAL DIRECTING: For news videos, heavily favor "corporate", "tech", or "minimal" for \`backgroundTheme\`. Use "slide-left" or "fade-in" for \`animationStyle\` to mimic TV news graphics. Choose \`accentColor\` wisely (e.g., #ef4444 Red for breaking news, #00d4ff Blue for tech/finance).
    - LANGUAGE: Detect the language of the TOPIC "${topic}". You MUST write the entire JSON response natively in that detected language.
    - "textContent": Write this as a "Lower-Third News Ticker". It must be a punchy, authoritative summary of the current scene's main fact. ABSOLUTE MAXIMUM 15 TO 30 WORDS.
    - "narration": Write this for a professional news anchor reading from a teleprompter. Pacing should be 2-5 engaging sentences.
    - "imagePrompt": Create visually striking, photorealistic image prompts relevant to the textContent. Use English even if the narration is in another language. Max 15 words. This field is MANDATORY for every scene.
    ${req.body.orientation === 'portrait' ? '- PORTRAIT MODE: This is for TikTok/Shorts. Keep "sceneTitle" to max 4 words. Focus on center-weighted visuals.' : ''}

    [OUTPUT]:
    Provide ONLY the valid JSON object following the VIDEO_SYSTEM_PROMPT schema.
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
      { timeout: 45000 } // Tăng lên 45s vì xử lý dữ liệu tin tức thô cần nhiều thời gian suy luận hơn
    );

    let text = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      throw new Error('Gemini did not return any content (possibly safety filtered).');
    }

    // Clean JSON string
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const scriptData = JSON.parse(text);
      res.json(scriptData);
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

    // 2. Scrape article using Jina Reader
    const scrapeResponse = await axios.get(`https://r.jina.ai/${articleUrl}`, {
      headers: { 'Authorization': `Bearer ${jinaKey}` },
      timeout: 20000
    });

    const scrapedContent = (scrapeResponse.data || "").trim();

    // 3. Anti-Paywall / Content check
    if (scrapedContent.length < 200) {
      return res.status(400).json({ error: 'Nội dung bài báo quá ngắn hoặc không thể truy cập (có thể do tường phí hoặc chặn truy cập).' });
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
      const scriptData = JSON.parse(text);
      res.json(scriptData);
    } catch (parseErr) {
      console.error('URL to Video Parse Error:', text);
      throw new Error('Kịch bản AI không đúng định dạng JSON.');
    }

  } catch (err) {
    console.error('URL to Video Error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    res.status(status).json({ 
      error: 'Lỗi xử lý link bài báo: ' + (err.response?.data?.error?.message || err.message) 
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 Tool đang chạy tại: http://localhost:${PORT}\n`);
});
