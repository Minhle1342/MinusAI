

const $ = (id) => document.getElementById(id);

// ── DOM References ────────────────────────────────────────────────────────────
const canvas          = $('videoCanvas');
const canvasOverlay   = $('canvasOverlay');
const generateBtn     = $('generateScriptBtn');
const playStopBtn     = $('playStopBtn');
const playStopIcon    = $('playStopIcon');
const resetBtn        = $('resetBtn');
const progressSection = $('progressSection');
const progressBar     = $('progressBar');
const progressPct     = $('progressPct');
const progressLabel   = $('progressLabel');
const scenesList      = $('scenesList');
const scriptPanel     = $('scriptPanel');
const downloadSection = $('downloadSection');
const downloadLink    = $('downloadLink');
const logPanel        = $('logPanel');
const btnGenerateNews = $('btnGenerateNews');
const newsLoadingStatus = $('newsLoadingStatus');
const newsLoadingText = $('newsLoadingText');

// ── State ─────────────────────────────────────────────────────────────────────
let renderer       = null;
let currentScript  = null;
let mediaRecorder  = null;
let recordedChunks = [];
let isRunning      = false;
let isPreviewMode  = false;
let videoBlob      = null;
let activeTab      = 'free';
let speechRate     = 1.0;

let activeAudio   = null;

// ── Init Renderer ─────────────────────────────────────────────────────────────
renderer = new VideoRenderer(canvas);

// ── Log System (Internal Only) ────────────────────────────────────────────────
function log(msg, type = 'info') {
  // Removed UI log panel updates as requested
}

// ── Progress ──────────────────────────────────────────────────────────────────
function setProgress(pct, label) {
  progressSection.style.display = 'block';
  progressBar.style.width = pct + '%';
  progressPct.textContent = Math.round(pct) + '%';
  if (label) progressLabel.textContent = label;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const geminiKey = localStorage.getItem('geminiKey');
  const elevenLabsKey = localStorage.getItem('elevenLabsKey');
  if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
  if (elevenLabsKey) headers['X-ElevenLabs-Key'] = elevenLabsKey;
  return headers;
}

// ── Settings Modal ────────────────────────────────────────────────────────────
$('settingsBtn').addEventListener('click', () => {
  $('geminiKeyInput').value = localStorage.getItem('geminiKey') || '';
  $('elevenLabsKeyInput').value = localStorage.getItem('elevenLabsKey') || '';
  $('settingsModal').classList.add('open');
});
$('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.remove('open'));
$('saveSettingsBtn').addEventListener('click', async () => {
  const geminiKey    = $('geminiKeyInput').value.trim();
  const elevenLabsKey = $('elevenLabsKeyInput').value.trim();
  if (!geminiKey) return alert('Gemini API key không được để trống!');
  
  try {
    localStorage.setItem('geminiKey', geminiKey);
    localStorage.setItem('elevenLabsKey', elevenLabsKey);
    $('settingsModal').classList.remove('open');
    if (elevenLabsKey) loadVoices();
  } catch (e) { alert('Lỗi khi lưu: ' + e.message); }
});

// ── Mode Tabs (Standard vs News) ─────────────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    document.querySelectorAll('.mode-tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.mode-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    $('mode-' + mode).classList.add('active');
  });
});

// ── News Hunter Logic ─────────────────────────────────────────────────────────
let newsLoadingInterval = null;
const newsMessages = [
  "🔍 Đang săn tìm tin tức nóng hổi trên toàn cầu...",
  "🌐 Đang kết nối với các nguồn báo uy tín...",
  "📄 Đang đọc và phân tích nội dung chuyên sâu...",
  "🧠 AI đang chắt lọc thông tin quan trọng nhất...",
  "✍️ Đang biên tập kịch bản video chuyên nghiệp...",
  "🎬 Đang chuẩn bị các cảnh quay tối ưu..."
];

async function handleNewsHunter() {
  const topic = $('newsTopicInput').value.trim();
  if (!topic) return alert('Vui lòng nhập chủ đề tin tức!');

  btnGenerateNews.disabled = true;
  newsLoadingStatus.classList.remove('hidden');
  let msgIdx = 0;
  newsLoadingText.textContent = newsMessages[0];
  
  // Rotate messages every 5-7 seconds
  newsLoadingInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % newsMessages.length;
    newsLoadingText.textContent = newsMessages[msgIdx];
  }, 6000);

  try {
    const r = await fetch('/api/news-to-video', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ topic })
    });

    const data = await r.json();
    if (data.error) throw new Error(data.error);

    // Stop loading
    clearInterval(newsLoadingInterval);
    newsLoadingStatus.classList.add('hidden');
    btnGenerateNews.disabled = false;

    // Use existing pipeline to start creation
    currentScript = data;
    startCreation(true); // withRecording = true
  } catch (e) {
    clearInterval(newsLoadingInterval);
    newsLoadingText.textContent = "❌ Lỗi: " + e.message;
    newsLoadingText.style.color = "var(--danger)";
    btnGenerateNews.disabled = false;
    setTimeout(() => {
      newsLoadingStatus.classList.add('hidden');
      newsLoadingText.style.color = "#a855f7";
    }, 5000);
  }
}

if (btnGenerateNews) {
  btnGenerateNews.addEventListener('click', handleNewsHunter);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + activeTab).classList.add('active');
  });
});

// ── Voice Loading ─────────────────────────────────────────────────────────────
async function loadVoices() {
  try {
    const r = await fetch('/api/voices', { headers: getHeaders() });
    const data = await r.json();
    if (data.voices.length > 0) {
      const sel = $('voiceSelect');
      sel.innerHTML = '';
      data.voices.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.voice_id;
        opt.textContent = `${v.name}`;
        sel.appendChild(opt);
      });
    }
  } catch (e) {}
}

// ── Speech Rate ───────────────────────────────────────────────────────────────
$('speechRate').addEventListener('input', (e) => {
  speechRate = parseFloat(e.target.value);
  $('rateLabel').textContent = speechRate.toFixed(1) + 'x';
});

// ── Test Voice ────────────────────────────────────────────────────────────────
$('testVoiceFreeBtn').addEventListener('click', async () => {
  await speakText('Xin chào! Đây là giọng đọc thử nghiệm của A.I.');
});
$('testVoiceBtn').addEventListener('click', async () => {
  await speakText('Xin chào! Đây là giọng đọc của ElevenLabs.');
});

// ── Generate Script & Auto-Start ──────────────────────────────────────────────
window.handleGenerate = async () => {
  const basePrompt = $('videoPrompt').value.trim();
  if (!basePrompt) return alert('Vui lòng nhập nội dung video!');

  const sceneCount = parseInt(document.getElementById('scene-count-slider').value) || 6;

  let prompt = basePrompt + `\n\nEach scene may contain a "renderMode" field with the values: "default", "glitch", "hand-drawn", "neon", "retro".\n\nChoose renderMode based on scene content:\n- "glitch": technology, hacking, security, AI, error-related scenes\n- "hand-drawn": ideas, creativity, educational explanations, conceptual scenes\n- "neon": opening titles, CTA scenes, major highlights\n- "retro": history, nostalgia, before/after comparisons\n- "default": normal scenes\n\nNot every scene needs a non-default renderMode.\n\nEach scene may contain an "elements" field — an array of up to 3 visual elements.\n\nOnly add elements when the scene contains numbers, statistics, or concrete comparisons.\nDo not add elements to intro scenes or ending scenes.\n\nElement types:\n\n- "stat-counter"\n  Use when there is a single highlighted number (revenue, users, percentages, etc.)\n  Required fields: type, label, value (number), position\n  Optional fields: prefix (default ""), suffix (default "")\n\n- "progress-bar"\n  Use when there is a percentage or completion metric\n  Required fields: type, label, percent (0-100), position\n\n- "chart"\n  Use when multiple data points need comparison (minimum 3 points)\n  Required fields:\n    type,\n    chartType ("bar" or "line"),\n    label,\n    data (array of {label, value}),\n    position\n\n  Maximum 6 data points.\n\nThe "position" field may only use these 3 values — do not use any others:\n\n- "bottom-left"\n  → use for stat-counter or progress-bar\n\n- "bottom-center"\n  → preferred for chart\n\n- "bottom-right"\n  → use for stat-counter or progress-bar\n\nPosition allocation rules by element count:\n\n- 1 element\n  → use "bottom-left"\n\n- 2 elements\n  → use "bottom-left" + "bottom-right"\n\n- 3 elements\n  → use "bottom-left" + "bottom-center" + "bottom-right"\n\nRules when a chart exists:\n\n- If a scene contains a "chart" element, allow a maximum of 2 elements in that scene\n- Charts must always use "bottom-center"\n- The remaining element uses either "bottom-left" or "bottom-right"\n\nDo not invent statistics — only use numbers provided by the user or numbers that reasonably match the content context.`;

  prompt += `\n\nGenerate a video script with EXACTLY ${sceneCount} scenes — no more, no fewer.\n\nDistribute the content evenly and logically across ${sceneCount} scenes.\n\n`;
  if (sceneCount <= 3) {
    prompt += `If ${sceneCount} is small (1–3):\nFocus only on the most essential points.\n\n`;
  } else if (sceneCount >= 15) {
    prompt += `If ${sceneCount} is large (15–30):\nExpand with more detail, examples, and deeper analysis.\n\n`;
  }

  // Resume context on user gesture
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const btn = $('generateScriptBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang xử lý...';

  try {
    const r = await fetch('/api/generate-script', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt }),
    });
    
    const data = await r.json();
    if (!data.success) throw new Error(data.error);

    // Validate and sanitize the script structure (LLM Guardrails - Phase 4)
    if (!data.script || !Array.isArray(data.script.scenes)) {
       throw new Error('Định dạng kịch bản trả về từ LLM không hợp lệ (mất scenes array).');
    }
    
    // Assign safe fallback defaults to prevent renderer crashes
    data.script.scenes.forEach(scene => {
       scene.renderMode = scene.renderMode || 'default';
       scene.animationStyle = scene.animationStyle || 'slide-up';
       scene.backgroundTheme = scene.backgroundTheme || 'tech';
       scene.accentColor = scene.accentColor || '#747689';
       scene.estimatedDuration = scene.estimatedDuration || 5;
       scene.narration = scene.narration || '';
       
       if (scene.elements && !Array.isArray(scene.elements)) {
          scene.elements = [];
       }
       
       if (scene.elements) {
          scene.elements.forEach(el => {
             el.type = el.type || 'stat-counter';
             el.position = el.position || 'bottom-center';
             el.label = el.label || '';
             // Ensure chart data array exists to prevent runtime .forEach errors
             if (el.type === 'chart' && !Array.isArray(el.data)) {
                el.data = [{ label: 'A', value: 100 }];
             }
          });
       }
    });

    currentScript = data.script;

    if (currentScript.scenes.length !== sceneCount) {
      console.warn(`Gemini returned ${currentScript.scenes.length} scenes, requested ${sceneCount}. Continuing with actual count.`);
    }

    canvasOverlay.classList.add('hidden');
    
    // Auto-start creation immediately without showing the script
    isPreviewMode = false;
    startCreation(true);
    
  } catch (e) {
    alert('Lỗi: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wand-2" style="width:15px;height:15px;"></i> Tạo video ngay';
    lucide.createIcons();
  }
};

// ── Script Preview (Logic hidden as requested) ────────────────────────────────
function renderScriptPreview() {
  // Do nothing
}

// ── Play/Stop Combined Logic ──────────────────────────────────────────────────
playStopBtn.addEventListener('click', () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  if (isRunning) {
    stopAll();
  } else {
    isPreviewMode = true;
    startCreation(false);
  }
});

function updatePlayStopIcon(running) {
  playStopIcon.setAttribute('data-lucide', running ? 'square' : 'play');
  lucide.createIcons();
}

// ── Stop / Reset ──────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', resetAll);

function stopAll() {
  isRunning = false;
  renderer.stop();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  window.speechSynthesis.cancel();
  updatePlayStopIcon(false);
  setButtonState('ready');
}

function resetAll() {
  stopAll();
  currentScript = null;
  recordedChunks = [];
  videoBlob = null;
  scriptPanel.style.display = 'none';
  downloadSection.style.display = 'none';
  progressSection.style.display = 'none';
  canvasOverlay.classList.remove('hidden');
  renderer.drawIdleScreen();
  setButtonState('initial');
}

function setButtonState(state) {
  switch (state) {
    case 'initial':
      playStopBtn.disabled = true;
      break;
    case 'ready':
      playStopBtn.disabled = false;
      updatePlayStopIcon(false);
      break;
    case 'running':
      playStopBtn.disabled = false;
      updatePlayStopIcon(true);
      break;
    case 'done':
      playStopBtn.disabled = false;
      updatePlayStopIcon(false);
      break;
  }
}

// ── TTS Logic ─────────────────────────────────────────────────────────────────
async function speakText(text) {
  if (activeTab === 'elevenlabs') {
    const success = await speakElevenLabs(text);
    if (success) return;
  }
  return speakFreeTTS(text);
}

function speakFreeTTS(text) {
  return new Promise(async (resolve) => {
    try {
      const r = await fetch(`/api/tts-free?text=${encodeURIComponent(text)}`);
      if (!r.ok) throw new Error('TTS Failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audio.playbackRate = speechRate;
      activeAudio = audio;
      window.activeAudio = audio;

      let source = null;
      if (audioCtx && masterGain) {
        source = audioCtx.createMediaElementSource(audio);
        source.connect(masterGain);
      }

      audio.onended = () => { 
        if (source) source.disconnect();
        URL.revokeObjectURL(url); 
        activeAudio = null;
        window.activeAudio = null;
        resolve(true); 
      };
      audio.onerror = () => {
        if (source) source.disconnect();
        activeAudio = null;
        window.activeAudio = null;
        resolve(false);
      };
      audio.play();
    } catch (e) { 
      activeAudio = null;
      window.activeAudio = null;
      resolve(false); 
    }
  });
}

function speakElevenLabs(text) {
  return new Promise(async (resolve) => {
    try {
      const voiceId = $('voiceSelect').value;
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text, voiceId }),
      });
      const data = await r.json();
      if (!data.success || data.useFallback) return resolve(false);

      const audioBytes = atob(data.audio);
      const buf = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) buf[i] = audioBytes.charCodeAt(i);
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audio.playbackRate = speechRate;
      activeAudio = audio;
      window.activeAudio = audio;

      let source = null;
      if (audioCtx && masterGain) {
        source = audioCtx.createMediaElementSource(audio);
        source.connect(masterGain);
      }

      audio.onended = () => { 
        if (source) source.disconnect();
        URL.revokeObjectURL(url); 
        activeAudio = null;
        window.activeAudio = null;
        resolve(true); 
      };
      audio.onerror = () => {
        if (source) source.disconnect();
        activeAudio = null;
        window.activeAudio = null;
        resolve(false);
      };
      await audio.play();
    } catch (e) { 
      activeAudio = null;
      window.activeAudio = null;
      resolve(false); 
    }
  });
}

// ── Audio Context ─────────────────────────────────────────────────────────────
let audioCtx = null;
let currentAudioDestination = null;
let masterGain = null;

async function setupAudioCapture() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    
    if (!currentAudioDestination) {
      currentAudioDestination = audioCtx.createMediaStreamDestination();
      masterGain = audioCtx.createGain();
      masterGain.connect(currentAudioDestination);
      masterGain.connect(audioCtx.destination); // Play to speakers too
    }
    
    return currentAudioDestination.stream;
  } catch (e) { 
    return null; 
  }
}

// ── Offline Export Engine ─────────────────────────────────────────────────────
async function getTTSAudioBuffer(text) {
   if (activeTab === 'elevenlabs') {
      const voiceId = $('voiceSelect').value;
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text, voiceId }),
      });
      const data = await r.json();
      if (data.success && !data.useFallback) {
         const audioBytes = atob(data.audio);
         const buf = new Uint8Array(audioBytes.length);
         for (let i = 0; i < audioBytes.length; i++) buf[i] = audioBytes.charCodeAt(i);
         return buf.buffer; // ArrayBuffer
      }
   }
   
   const r = await fetch(`/api/tts-free?text=${encodeURIComponent(text)}`);
   if (r.ok) {
     return await r.arrayBuffer();
   }
   return null;
}

class ExportEngine {
  constructor(canvas, fps = 60) {
    this.canvas = canvas;
    this.fps = fps;
    this.muxer = null;
    this.videoEncoder = null;
    this.audioEncoder = null;
    this.frameDurationMicro = 1e6 / this.fps;
    this.hasError = false;
  }

  async init(width, height, bitrate = 5000000, audioBuffer = null) {
    this.muxer = new WebMMuxer.Muxer({
      target: new WebMMuxer.ArrayBufferTarget(),
      video: { codec: 'V_VP9', width, height, frameRate: this.fps },
      audio: audioBuffer ? {
        codec: 'A_OPUS',
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels
      } : undefined
    });

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error("VideoEncoder Error:", e);
        this.hasError = true;
      }
    });

    await this.videoEncoder.configure({
      codec: 'vp09.00.10.08',
      width, height, bitrate, framerate: this.fps
    });

    if (audioBuffer) {
      await this.encodeAudioBuffer(audioBuffer);
    }
  }

  async encodeAudioBuffer(audioBuffer) {
    return new Promise((resolve) => {
      this.audioEncoder = new AudioEncoder({
        output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
        error: (e) => console.error("AudioEncoder Error:", e)
      });

      this.audioEncoder.configure({
        codec: 'opus',
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        bitrate: 128000
      });

      const length = audioBuffer.length;
      const channels = audioBuffer.numberOfChannels;
      const planarData = new Float32Array(length * channels);
      for (let c = 0; c < channels; c++) {
        planarData.set(audioBuffer.getChannelData(c), c * length);
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: audioBuffer.sampleRate,
        numberOfFrames: length,
        numberOfChannels: channels,
        timestamp: 0,
        data: planarData
      });

      this.audioEncoder.encode(audioData);
      audioData.close();
      
      this.audioEncoder.flush().then(() => {
        this.audioEncoder.close();
        resolve();
      });
    });
  }

  async encodeVideoFrame(frameIndex) {
    if (this.hasError) return;

    // Throttle: Wait if the encoder queue is getting backed up to prevent GPU out-of-memory
    while (this.videoEncoder.encodeQueueSize > 30) {
      await new Promise(r => setTimeout(r, 5));
      if (this.hasError) return;
    }

    const timestampMicro = Math.round(frameIndex * this.frameDurationMicro);
    const keyFrame = (frameIndex % this.fps === 0);

    try {
      // Capture the canvas as an ImageBitmap to provide a stable texture for the encoder
      const bitmap = await createImageBitmap(this.canvas);
      const frame = new VideoFrame(bitmap, { timestamp: timestampMicro });
      
      this.videoEncoder.encode(frame, { keyFrame });
      
      frame.close();
      bitmap.close(); // Crucial to release the bitmap resource immediately
    } catch (e) {
      console.error("VideoFrame creation/encoding failed:", e);
      this.hasError = true;
    }
  }

  async finalize() {
    await this.videoEncoder.flush();
    this.videoEncoder.close();
    this.muxer.finalize();
    const buffer = this.muxer.target.buffer;
    return new Blob([buffer], { type: 'video/webm; codecs=vp9,opus' });
  }
}

// ── Main Video Creation Pipeline ──────────────────────────────────────────────
async function startCreation(withRecording) {
  if (!currentScript?.scenes?.length || isRunning) return;

  if (withRecording) {
    return startOfflineExport();
  }

  // Preview Mode (Realtime)
  isRunning = true;
  setButtonState('running');
  progressSection.style.display = 'block';
  canvasOverlay.classList.add('hidden');

  const scenes = currentScript.scenes.map(s => ({ ...s, videoTitle: currentScript.videoTitle || '' }));
  renderer.setScenes(scenes);

  for (let i = 0; i < scenes.length; i++) {
    if (!isRunning) break;
    const scene = scenes[i];
    setProgress((i / scenes.length) * 100, `Đang xử lý cảnh ${i + 1}...`);

    await new Promise(res => {
      renderer.onSceneTitleShown = res;
      renderer.renderScene(i);
    });

    await new Promise(res => setTimeout(res, 300));
    if (!isRunning) break;

    await speakText(scene.narration);
    if (!isRunning) break;

    await new Promise(res => {
      renderer.onSceneComplete = res;
      renderer.exitScene();
    });
  }

  if (isRunning) {
    isRunning = false;
    setButtonState('done');
    progressSection.style.display = 'none';
  }
}

async function startOfflineExport() {
  isRunning = true;
  setButtonState('running');
  downloadSection.style.display = 'none';
  progressSection.style.display = 'block';
  canvasOverlay.classList.add('hidden');

  const scenes = currentScript.scenes.map(s => ({ ...s, videoTitle: currentScript.videoTitle || '' }));
  
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // 1. Fetch and decode all audio
  const sceneAudioData = [];
  const ENTER_DURATION = 0.8;
  const GAP_DURATION = 0.3;
  const EXIT_DURATION = 0.5;

  let totalDurationSec = 0;
  const sceneTimings = [];

  for (let i = 0; i < scenes.length; i++) {
    if (!isRunning) return;
    setProgress((i / scenes.length) * 20, `Đang tải âm thanh cảnh ${i+1}...`);
    
    let audioBuf = null;
    if (scenes[i].narration && scenes[i].narration.trim()) {
       const arrayBuf = await getTTSAudioBuffer(scenes[i].narration);
       if (arrayBuf) {
          audioBuf = await audioCtx.decodeAudioData(arrayBuf);
       }
    }
    sceneAudioData.push(audioBuf);
    
    const audioDur = audioBuf ? (audioBuf.duration / speechRate) : (scenes[i].estimatedDuration || 5);
    const sceneTotalSec = ENTER_DURATION + GAP_DURATION + audioDur + EXIT_DURATION;
    
    sceneTimings.push({
      sceneStart: totalDurationSec,
      audioStart: totalDurationSec + ENTER_DURATION + GAP_DURATION,
      audioBuffer: audioBuf,
      audioDuration: audioDur,
      sceneEnd: totalDurationSec + sceneTotalSec
    });
    
    totalDurationSec += sceneTotalSec;
  }

  if (!isRunning) return;
  setProgress(20, `Đang kết xuất Audio Track toàn cục...`);
  
  // 2. Mix Offline Audio
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDurationSec * 48000), 48000);
  for (let i = 0; i < sceneTimings.length; i++) {
    const timing = sceneTimings[i];
    if (timing.audioBuffer) {
      const source = offlineCtx.createBufferSource();
      source.buffer = timing.audioBuffer;
      source.playbackRate.value = speechRate;
      source.connect(offlineCtx.destination);
      source.start(timing.audioStart);
    }
  }
  const finalAudioBuffer = await offlineCtx.startRendering();

  if (!isRunning) return;
  // 3. Setup Video Encoder
  setProgress(25, `Đang khởi tạo Video Encoder...`);
  const fps = 60;
  const exportEngine = new ExportEngine(canvas, fps);
  await exportEngine.init(canvas.width, canvas.height, 5000000, finalAudioBuffer);

  // 4. Render Offline Loop
  renderer.setScenes(scenes);
  renderer.offlineMode = true;
  
  const totalFrames = Math.ceil(totalDurationSec * fps);
  let currentSceneIdx = 0;
  renderer.renderScene(0, 0);

  for (let f = 0; f < totalFrames; f++) {
    if (!isRunning) break;
    const currentTime = f / fps; // seconds
    const currentMs = currentTime * 1000;
    const timing = sceneTimings[currentSceneIdx];

    // Scene Transition
    if (currentTime >= timing.sceneEnd && currentSceneIdx < scenes.length - 1) {
      currentSceneIdx++;
      renderer.renderScene(currentSceneIdx, currentMs);
    }
    
    // Trigger Exit Animation
    if (renderer.phase === 'displaying' && currentTime >= timing.audioStart + timing.audioDuration) {
      renderer.exitScene(currentMs);
    }

    // Mock Audio for Single Source of Truth
    if (currentTime >= timing.audioStart && currentTime <= timing.audioStart + timing.audioDuration) {
      window.activeAudio = {
        currentTime: currentTime - timing.audioStart,
        duration: timing.audioDuration
      };
    } else {
      window.activeAudio = null;
    }

    // Explicitly update time and render
    renderer.globalTime = currentTime;
    renderer.phaseTime = currentTime - (renderer.phaseStartTime / 1000);
    renderer.updateParticles(1/fps);
    renderer._drawScene(scenes[currentSceneIdx], 1/fps, currentMs);

    // Encode
    await exportEngine.encodeVideoFrame(f);
    if (exportEngine.hasError) {
      isRunning = false;
      alert("Lỗi mã hóa video (GPU/Codec). Vui lòng thử lại hoặc giảm số lượng cảnh.");
      break;
    }

    // Async Yield for UI update every 10 frames
    if (f % 10 === 0) {
      const pct = 25 + (f / totalFrames) * 70;
      setProgress(pct, `Đang Render Frame (${f}/${totalFrames}) - Đảm bảo mượt mà 60 FPS`);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (isRunning) {
    setProgress(98, `Đang đóng gói ra WebM...`);
    const blob = await exportEngine.finalize();
    videoBlob = blob;
    const videoUrl = URL.createObjectURL(videoBlob);
    downloadLink.href = videoUrl;
    downloadLink.download = `MinusAI_Video_${Date.now()}.webm`;
    
    // Set preview video
    const previewEl = $('finalPreview');
    if (previewEl) {
      previewEl.src = videoUrl;
      previewEl.load();
    }
    
    downloadSection.style.display = 'block';
    downloadSection.scrollIntoView({ behavior: 'smooth' });
    
    isRunning = false;
    setButtonState('done');
    progressSection.style.display = 'none';
  }

  renderer.offlineMode = false;
  renderer.stop();
  window.activeAudio = null;
}

// ── Scene Count Slider Init ───────────────────────────────────────────────────
const countSlider = $('scene-count-slider');
const countDisplay = $('scene-count-display');

const updateSlider = (val) => {
  countDisplay.textContent = val;
  countSlider.style.setProperty('--value', `${((val - 1) / 29) * 100}%`);
};

if (countSlider && countDisplay) {
  countSlider.addEventListener('input', () => updateSlider(parseInt(countSlider.value)));
  updateSlider(parseInt(countSlider.value));
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  loadVoices();
  lucide.createIcons();
})();
