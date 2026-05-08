# MinusAI: Autonomous Video Generation Engine

> **Vision:** MinusAI is a high-performance, deterministic AI video generation engine that transforms simple text prompts or breaking news topics into professional, 60fps cinematic videos with synchronized audio, dynamic typography, and engaging visual effects—all running autonomously within the browser and Node.js backend.

## ✨ Key Features

- **📰 Autonomous News Hunting:** Integrated with **Jina AI Search** (and adaptable for Tavily), the "News Hunter" pipeline scours the web for breaking news, extracts the "5 Ws" (Who, What, When, Where, Why), and synthesizes a 100% fact-grounded video script using **Gemini 3.1 Flash**.
- **🎥 60FPS Deterministic Rendering:** Bypasses the unreliable, wall-clock dependent `MediaRecorder` in favor of a native **WebCodecs** (`VideoEncoder`) and `webm-muxer` pipeline. This ensures frame-perfect 60fps offline exports with zero dropped frames, regardless of GPU load.
- **🎙️ Absolute Audio-Visual Sync:** Utilizes `OfflineAudioContext` to pre-render and mix the entire audio track (narration + gaps) into a single buffer before video encoding begins, serving as the "Single Source of Truth" for visual animations.
- **🎨 Advanced Canvas Typography & Routing:** Features a robust Greedy Line Breaking typography engine (`wrapText`) anchored to safe visual zones (Top-Left), ensuring text and dynamic elements (charts, progress bars) never overlap.

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5 Canvas API, WebCodecs (`VideoEncoder`, `AudioEncoder`), `webm-muxer`, `OfflineAudioContext`.
- **Backend:** Node.js, Express.js, Axios.
- **AI & APIs:**
  - **LLM:** Google Gemini 3.1 Flash Lite Preview (Script Synthesis & Directing)
  - **Voice:** ElevenLabs API (Premium TTS) & Google Translate Proxy (Free Fallback)
  - **Search:** Jina AI Search API (News crawling)

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+ recommended)
- API Keys for Gemini, ElevenLabs (optional), and Jina AI.

### 2. Environment Setup
Copy the example environment file and fill in your keys:
```bash
cp .env.example .env
```

Your `.env` should look like this (DO NOT expose real keys):
```env
# REQUIRED: Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# OPTIONAL: ElevenLabs API Key
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL

# OPTIONAL: Jina Search API Key (for News Hunter)
JINA_API_KEY=your_jina_api_key_here

PORT=3000
```

### 3. Installation & Running
Install dependencies and start the local server:
```bash
npm install
npm run dev
```

Open your browser and navigate to `http://localhost:3000`.

## 📖 Architecture Deep Dive
For a comprehensive breakdown of the client-server data flow, deterministic export strategy, and anti-hallucination prompt engineering, see the [Architecture Documentation](architecture.md).

---
*MinusAI - Turning ideas into visual reality at 60 frames per second.*
