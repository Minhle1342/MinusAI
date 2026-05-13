# MinusAI: Autonomous Video Generation Engine

> **Vision:** MinusAI is a high-performance, deterministic AI video generation engine that transforms simple text prompts, breaking news, or full article URLs into professional, 60fps cinematic videos with synchronized audio, dynamic typography, and engaging visual effects—all running autonomously within the browser and Node.js backend.

## ✨ Key Features

- **📰 Article-to-Video Pipeline:** Paste any news URL. The "News Hunter" (powered by **Jina AI**) scrapes the content, while Gemini 1.5 Flash extracts metadata, identifying thumbnails, YouTube clips, or direct MP4 links to include as dynamic scenes.
- **🎥 Multimedia Directing:** Automatically selects the best visual assets from the source article. Supports direct video scene rendering with custom start/end timestamps via a custom **Range-aware Proxy**.
- **📺 Direct YouTube Upload:** Integrated OAuth 2.0 flow allows you to upload exported videos directly to your channel. Automatically detects portrait orientation to publish as **YouTube Shorts** with appropriate tagging.
- **🎙️ High-Fidelity TTS:** Features **Edge-TTS** for free, high-quality neural narration with multiple voice options, ensuring high-production value without API costs.
- **🚀 60FPS Deterministic Rendering:** Bypasses the unreliable `MediaRecorder` in favor of a native **WebCodecs** (`VideoEncoder`) and `webm-muxer` pipeline for frame-perfect exports.
- **🌍 Multi-Language Support:** Fully localized interface supporting English and Vietnamese, with an extensible i18n engine for dynamic UI translation.
- **🛡️ Industrial Robustness:** Built-in global error handling, API timeouts, and client-side retry mechanisms to ensure high success rate in long video exports.
- **🎨 Dynamic Typography:** Robust line-breaking engine anchored to safe visual zones, ensuring headlines and data visualizations (charts, stats) never overlap.

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5 Canvas API, WebCodecs (`VideoEncoder`), `webm-muxer`, `OfflineAudioContext`.
- **Backend:** Node.js, Express.js.
- **AI & APIs:**
  - **LLM:** Google Gemini 1.5 Flash (Scripting & Media Extraction)
  - **Voice:** Edge-TTS (Neural Narration)
  - **Search & Scraping:** Jina AI Search API
  - **Video Hosting:** YouTube Data API v3 (Upload Pipeline)

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+ recommended)
- API Keys for Gemini and Jina AI.
- Google Cloud Project credentials for YouTube Upload (optional).

### 2. Environment Setup
Copy the example environment file and fill in your keys:
```bash
cp .env.example .env
```

Your `.env` should include:
```env
# REQUIRED
GEMINI_API_KEY=your_gemini_api_key
JINA_API_KEY=your_jina_api_key

# OPTIONAL: YouTube Upload
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

PORT=3000
```

### 3. Installation & Running
```bash
npm install
npm run dev
```

Open `http://localhost:3000` to start creating.

## 📖 Architecture Deep Dive
For a comprehensive breakdown of the deterministic export strategy, media proxying, and sync logic, see the [Architecture Documentation](architecture.md).

---
*MinusAI - Turning articles into visual reality at 60 frames per second.*
