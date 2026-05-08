# MinusAI Architecture & Technical Deep Dive

This document outlines the internal architecture, system modules, and critical design decisions behind the MinusAI video generation engine.

## 1. System Overview (Client-Server Data Flow)

MinusAI operates on a hybrid architecture where heavy AI inference and data gathering occur on the Node.js backend, while the intensive graphical rendering and video encoding are offloaded to the client's browser using native Web APIs.

**Data Flow:**
1. **User Input:** User provides a text prompt or selects a news topic via the UI (`index.html`).
2. **Backend Synthesis (`server.js`):** The Express server receives the request. For "News Hunter", it queries Jina AI Search, truncates the HTML/Markdown payload, and pipes it to Gemini 3.1 Flash with a strict JSON-enforcing `VIDEO_SYSTEM_PROMPT`.
3. **Audio Generation:** The client requests Text-to-Speech (TTS) via ElevenLabs or Google Translate Proxy (`server.js`), receiving base64 audio buffers.
4. **Rendering & Encoding (`app.js` & `renderer.js`):** The client pre-mixes all audio, iterates frame-by-frame on an HTML5 Canvas, and passes explicit timestamps to the `WebCodecs` API to generate a final `.webm` blob.

## 2. Module Breakdown

### `server.js` (The Brain)
- **AI Orchestration:** Manages API keys (via headers or `.env`) and communicates with Google Gemini.
- **News Hunter Pipeline:** Implements `POST /api/news-to-video`. Connects to Jina AI Search (and supports Tavily concepts) to fetch live data.
- **Prompt Engineering:** Enforces anti-hallucination and journalistic standards via the `VIDEO_SYSTEM_PROMPT`, forcing Gemini to act as a TV Producer and output structured JSON (`sceneTitle`, `textContent`, `narration`, `elements`).
- **TTS Proxy:** Securely routes ElevenLabs premium voice requests and provides a free Google Translate TTS fallback.

### `public/app.js` (The Engine)
- **State Management:** Handles UI tabs, settings, and progress bars.
- **`ExportEngine`:** The core offline video compiler. Wraps `WebCodecs` (`VideoEncoder`, `AudioEncoder`) and `webm-muxer` to stitch frames and audio into a final video file.
- **Audio Pre-mixing:** Utilizes `OfflineAudioContext` to sequence the scene narrations and silent gaps into a single, cohesive audio track before video encoding starts.

### `public/renderer.js` (The Studio)
- **Canvas Director:** Manages the `requestAnimationFrame` loop (for preview) and manual frame iteration (for offline export).
- **Typography Engine:** Implements the `wrapText` utility utilizing Greedy Line Breaking and `ctx.measureText` to dynamically fit descriptive paragraphs ("Lower-Third News Tickers") into safe zones.
- **Visual Element Routing:** Calculates safe screen coordinates (`bottom-left`, `bottom-center`, `bottom-right`) for dynamic charts and statistics, ensuring they never overlap with the Top-Left anchored `sceneTitle`.
- **Particle & FX System:** Handles background gradients, glitche effects, and cinematic transitions.

## 3. Critical Design Decisions (The "Why")

### 1. WebCodecs + webm-muxer vs. MediaRecorder
**The Problem:** Originally, capturing the canvas stream via `MediaRecorder` resulted in dropped frames, stuttering, and severe A/V desync. `MediaRecorder` relies on real-time wall-clock execution. If a complex Canvas frame takes 30ms to render instead of 16ms, `MediaRecorder` misses the 60fps window, resulting in a slowed-down, choppy video.
**The Solution:** We transitioned to native **WebCodecs API** (`VideoEncoder`). This allows us to manually render a frame, freeze the state using `createImageBitmap`, and pass it to the encoder with an **explicit, deterministic timestamp** (`timestamp: frameIndex * 1e6 / fps`). 
**Result:** Even if the GPU is heavily throttled or a frame takes 2 seconds to draw, the resulting video plays back flawlessly at a constant 60fps. A queue throttling mechanism (`encodeQueueSize > 30`) prevents GPU memory exhaustion during large exports.

### 2. Audio-Visual Synchronization Strategy
**The Problem:** Web Audio API (`AudioContext`) is designed for real-time playback. Syncing real-time audio playback with an offline, frame-by-frame video renderer is impossible, leading to misaligned lip-syncing or mismatched scene transitions.
**The Solution:** We implemented an **Absolute Timeline Source of Truth** using `OfflineAudioContext`. 
1. The system pre-calculates the exact start/end times of every narration clip and transition gap.
2. `OfflineAudioContext` renders the entire timeline instantly into a single massive AudioBuffer.
3. During the video frame iteration, the renderer calculates its progress *strictly* against the pre-calculated audio timeline (`activeAudio.currentTime`), ensuring the visual transitions occur precisely when the audio dictates.

### 3. Anti-Hallucination & News Hunter Concurrency
**The Problem:** LLMs tend to invent facts or write generic fluff when asked to create news scripts. Furthermore, sequential API calls (Search -> TTS -> Render) cause unacceptable UX latency.
**The Solution:** 
- **Prompt Engineering:** The `newsPrompt` strictly forces the AI into an "Elite TV News Producer" persona. It mandates the extraction of the "5 Ws" and strictly forbids inventing data not present in the injected `SEARCH DATA`. 
- **Typography constraints:** By restricting `textContent` to an "ABSOLUTE MAXIMUM 15 WORDS" Lower-Third ticker, we force the LLM to synthesize punchy, factual headlines rather than rambling paragraphs.
- **Execution:** We handle the latency via a simulated multi-stage UI loading state, keeping the user engaged while `server.js` manages the heavy lifting. Audio tracks are fetched asynchronously using `Promise.allSettled` patterns in the export loop to prepare resources before the encoder needs them.
