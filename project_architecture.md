# Project Architecture: AI Video Creator

A high-performance, browser-based AI video generation engine that transforms text prompts into cinematic videos using multi-mode rendering and AI-driven orchestration.

## 1. Directory Structure (Core Source)
```text
Ma_Nguon_AI_Video/
├── public/                 # Frontend Assets
│   ├── index.html          # UI Entry Point & Control Panel
│   ├── style.css           # Vanilla CSS (Glassmorphism UI)
│   ├── app.js              # Coordination Logic & State Management
│   └── renderer.js         # Core Canvas 2D Rendering Engine (v2.0)
├── server.js               # Express Backend (API Proxy & Orchestration)
├── config.json             # Local Persistent Settings
├── .env                    # Environment Variables
├── package.json            # Dependencies & Scripts
└── AGENTS.md               # Behavioral Guidelines & Context
```

## 2. Technology Stack
- **Runtime**: Node.js
- **Backend**: Express.js
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS3
- **AI Integration**:
  - **Gemini 3.1 Flash**: Script generation & scene directing.
  - **ElevenLabs API**: High-quality multilingual TTS.
  - **Google Translate API**: Secondary free TTS fallback.
- **Tools**: Axios (HTTP), Lucide (Icons), MediaRecorder API (Video export).

## 3. Architectural Patterns
- **Client-Server Architecture**: Separation of AI orchestration (Server) and visual rendering/recording (Client).
- **Engine-Driver Pattern**: `renderer.js` serves as the pure rendering engine (Engine), while `app.js` drives the engine based on AI-generated script (Driver).
- **Stateless Proxy**: The backend acts as a stateless intermediary for sensitive API keys and heavy AI requests.

## 4. Key Modules & Responsibilities

### Backend (`server.js`)
- **Script Orchestrator**: Handles `/api/generate-script`, refining user prompts with complex system instructions for Gemini.
- **TTS Proxy**: Manages `/api/tts` (ElevenLabs) and `/api/tts-free` (Google), handling audio buffer concatenation and encoding.
- **Config Manager**: Synchronizes user settings between the UI and `config.json`.

### Frontend - Coordinator (`app.js`)
- **State Machine**: Manages video generation lifecycle (Idle -> Generating -> Running -> Done).
- **Audio-Visual Sync**: Synchronizes the Canvas render loop with the playback of TTS audio chunks.
- **Recording Pipeline**: Captures the Canvas MediaStream and AudioStream into a downloadable `.webm` container.

### Frontend - Engine (`renderer.js`)
- **Render Modes**: Modular logic for 2D, 3D-Pseudo, Particle, Liquid, and Glitch rendering.
- **Animation System**: RequestAnimationFrame-based loop with easing functions for smooth transitions.
- **Overlay Engine**: Post-processing effects (Vignette, Bloom, Film Grain) applied per-frame.

## 5. Data Model (JSON Contract)
The system operates on a centralized **Video Script JSON** contract:
- **GlobalTheme**: Defines color palettes, font styles, and transition types.
- **Scenes**: Array of scene objects containing:
  - `narration`: Spoken text.
  - `renderMode`: The visual style (e.g., `particle`, `glitch`).
  - `visualElements`: Array of dynamic objects (charts, stats, icons) with specific positioning and animations.
  - `camera`: Pseudo-3D motion parameters.

## 6. Security & Persistence
- **API Keys**: Stored in `config.json` or `.env`. Redacted from all logs.
- **Persistence**: File-based local storage for user preferences. No external database required.
