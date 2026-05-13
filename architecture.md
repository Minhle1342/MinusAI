# MinusAI Architecture & Technical Deep Dive

This document outlines the internal architecture, system modules, and critical design decisions behind the MinusAI video generation engine.

## 1. System Overview (Client-Server Data Flow)

MinusAI operates on a hybrid architecture where heavy AI inference and data gathering occur on the Node.js backend, while the intensive graphical rendering and video encoding are offloaded to the client's browser using native Web APIs.

**Data Flow:**
1. **User Input:** User provides a text prompt, news topic, or an article URL via the UI.
2. **Media Extraction (`server.js`):** For article URLs, Jina AI scrapes the content. Gemini then analyzes the text to extract the "5 Ws" and identifies multimedia assets: Article Thumbnails, YouTube IDs, or direct MP4 links.
3. **Backend Synthesis:** The server generates a structured script JSON including `videoScene` markers if relevant media was found.
4. **Audio Generation:** The backend utilizes **Edge-TTS** to generate high-quality narration files (.mp3) which are then streamed/buffered to the client.
5. **Rendering & Encoding (`app.js` & `renderer.js`):** The client pre-mixes audio, prepares the Canvas, and loads external media via the **Media Proxy**. It iterates frame-by-frame, extracting frames from `HTMLVideoElement` for video scenes, and uses **WebCodecs** to encode the final `.webm`.
6. **Distribution:** The user can download the file or use the **YouTube Pipeline** to upload directly via OAuth 2.0.

## 2. Module Breakdown

### `server.js` (The Brain)
- **AI Orchestration:** Communicates with Google Gemini for script writing and media selection.
- **News & Media Extraction:** 
    - **Jina AI:** Fetches article content.
    - **Multimedia Scraper:** Extracts `thumbnail`, `youtubeId`, and `videoUrl`.
- **Media Proxy:** Provides `/api/proxy-image` and `/api/proxy-video`. The video proxy supports **HTTP Range requests**, essential for seeking and buffering high-quality MP4s in the browser without CORS blocking.
- **YouTube Pipeline:** Manages OAuth 2.0 client secrets, session-based token storage, and the `upload` stream to YouTube Data API v3.
- **Edge-TTS:** Provides free, high-quality, neural text-to-speech without the overhead of premium API costs.

### `public/app.js` (The Engine)
- **State Management:** Handles the Storyboard UI, including dynamic timestamp controls (start/end) for video scenes.
- **`ExportEngine`:** Wraps `WebCodecs` (`VideoEncoder`) and `webm-muxer`.
- **Audio Pre-mixing:** Uses `OfflineAudioContext` to sequence narrations and gaps into a single "Source of Truth" buffer.

### `public/renderer.js` (The Studio)
- **Canvas Director:** Manages the render loop.
- **Video Renderer:** Features a dedicated `videoElement` that synchronizes with the canvas time. It uses `drawImage` to extract and scale frames from live video streams into the canvas pipeline.
- **Typography Engine:** Fits descriptive text into safe zones.
- **Particle & FX System:** Cinematic transitions and background effects.

## 3. Critical Design Decisions (The "Why")

### 1. WebCodecs + webm-muxer vs. MediaRecorder
**The Problem:** Originally, capturing the canvas stream via `MediaRecorder` resulted in dropped frames and A/V desync because it relies on real-time execution.
**The Solution:** We transitioned to **WebCodecs API** (`VideoEncoder`). We manually render each frame and pass it to the encoder with an **explicit, deterministic timestamp**.
**Result:** Flawless 60fps video regardless of hardware speed.

### 2. Video Proxying with Range Support
**The Problem:** Most external video hosts (news sites, CDNs) block canvas extraction via CORS and don't support partial content (Range) via simple proxies, making it impossible to "seek" to a specific timestamp in a video scene.
**The Solution:** We built a custom **Range-aware Proxy**. It pipes requests from the browser to the target server while correctly handling headers like `Range`, `Content-Length`, and `Accept-Ranges`.
**Result:** The browser treats the proxied MP4 as a native, seekable stream, allowing the `ExportEngine` to capture specific clips (e.g., from 00:10 to 00:15) accurately.

### 3. Absolute Timeline Source of Truth
**The Problem:** Syncing audio playback with an offline, frame-by-frame renderer is impossible.
**The Solution:** We use an **Absolute Timeline** pre-calculated via `OfflineAudioContext`. The renderer's progress is mapped strictly to the audio buffer's indices, ensuring pixel-perfect lip-sync.

### 4. YouTube OAuth & Shorts Detection
**The Problem:** Users want to publish quickly, and YouTube Shorts require specific metadata.
**The Solution:** Integrated a server-side OAuth 2.0 flow. The app automatically detects the video orientation (Portrait 9:16) and appends `#Shorts` to the title/description during the upload process to trigger YouTube's Shorts algorithm.
## 4. Localization & Internationalization (i18n)
MinusAI features a built-in i18n engine designed for real-time language switching without page reloads.
- **Unified Dictionary:** A centralized `i18n` object in `app.js` holds translations for UI labels, placeholders, tooltips, and system alerts.
- **Attribute-based Translation:** The UI uses `data-i18n`, `data-i18n-placeholder`, and `data-i18n-tooltip` attributes. The `setLanguage()` function scans the DOM and updates these elements dynamically.
- **Persistence:** User language preference is stored in `localStorage` to maintain consistency across sessions.

## 5. Robustness & Stability Measures
To ensure reliable video generation, especially during long-running tasks:
- **Global Error Handling:** The Node.js backend includes `unhandledRejection` and `uncaughtException` handlers to prevent process crashes.
- **Request Timeouts:** All external API calls (Gemini, Jina, Image Proxy) have enforced timeouts (15s to 60s) to prevent hanging requests from exhausting server resources.
- **Retry Mechanisms:** Client-side preloading functions for images and audio incorporate retry logic with exponential backoff to handle transient network issues.
- **Memory Optimization:** Route handling for large JSON scripts and raw video uploads has been tuned with specific memory limits (up to 50MB for scripts, 2GB for raw video).
