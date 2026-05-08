require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Extract keys from request headers or fallback to environment variables
function getGeminiKey(req) {
  return req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
}

function getElevenLabsKey(req) {
  return req.headers['x-elevenlabs-key'] || process.env.ELEVENLABS_API_KEY;
}

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
      "estimatedDuration": seconds_number
    }
  ]
}

CREATIVE RULES:
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
          temperature: 0.8,
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
      // Try to clean up text if it failed
      try {
        // Remove potential trailing commas before closing braces/brackets
        let cleanedText = text.replace(/,\s*([\]}])/g, '$1');
        // Extract only the part between the first { and last }
        const match = cleanedText.match(/\{[\s\S]*\}/);
        if (match) {
          scriptData = JSON.parse(match[0]);
        } else {
          throw parseErr;
        }
      } catch (innerErr) {
        console.error('Lỗi phân tích JSON gốc:', text);
        throw new Error('Không thể phân tích JSON từ Gemini: ' + text.slice(0, 200));
      }
    }

    res.json({ success: true, script: scriptData });
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Generate TTS with ElevenLabs
app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const elevenLabsKey = getElevenLabsKey(req);
  const vid = voiceId || process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

  if (!elevenLabsKey) {
    // Return empty so frontend uses Web Speech API fallback
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
          'xi-api-key': elevenLabsKey,
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

// Get ElevenLabs voices
app.get('/api/voices', async (req, res) => {
  const elevenLabsKey = getElevenLabsKey(req);
  if (!elevenLabsKey) return res.json({ voices: [] });
  try {
    const r = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': elevenLabsKey },
    });
    // Filter for Vietnamese or high quality multilingual voices
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
    
    // 2. Synthesize news into a video script using Gemini
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

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 Tool đang chạy tại: http://localhost:${PORT}\n`);
});
