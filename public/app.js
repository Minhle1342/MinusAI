

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

// ── API Status ────────────────────────────────────────────────────────────────
async function checkApiStatus() {
  try {
    await fetch('/api/config');
  } catch (e) {
  }
}

// ── Settings Modal ────────────────────────────────────────────────────────────
$('settingsBtn').addEventListener('click', () => $('settingsModal').classList.add('open'));
$('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.remove('open'));
$('saveSettingsBtn').addEventListener('click', async () => {
  const geminiKey    = $('geminiKeyInput').value.trim();
  const elevenLabsKey = $('elevenLabsKeyInput').value.trim();
  if (!geminiKey) return alert('Gemini API key không được để trống!');
  
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: geminiKey, elevenLabsApiKey: elevenLabsKey }),
    });
    await checkApiStatus();
    $('settingsModal').classList.remove('open');
    if (elevenLabsKey) loadVoices();
  } catch (e) { alert('Lỗi khi lưu: ' + e.message); }
});

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
    const r = await fetch('/api/voices');
    const data = await r.json();
    if (data.voices.length > 0) {
      const sel = $('voiceSelect');

      // Collect existing pre-made voice IDs to avoid duplicates
      const existingIds = new Set();
      sel.querySelectorAll('option').forEach(opt => existingIds.add(opt.value));

      // Filter out voices that already exist in pre-made list
      const newVoices = data.voices.filter(v => !existingIds.has(v.voice_id));

      if (newVoices.length > 0) {
        // Remove old API group if re-loading
        const oldGroup = document.getElementById('voiceGroupAPI');
        if (oldGroup) oldGroup.remove();

        const group = document.createElement('optgroup');
        group.id = 'voiceGroupAPI';
        group.label = '🔑 Giọng từ tài khoản';
        newVoices.forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v.voice_id;
          opt.textContent = v.name;
          group.appendChild(opt);
        });
        sel.appendChild(group);
      }
    }
  } catch (e) {}
}

// ── Speech Rate ───────────────────────────────────────────────────────────────
$('speechRate').addEventListener('input', (e) => {
  speechRate = parseFloat(e.target.value);
  $('rateLabel').textContent = speechRate.toFixed(1) + 'x';
});

// ── Test Voice ────────────────────────────────────────────────────────────────
const LANG_SAMPLES = {
  'vi':    'Xin chào! Đây là giọng đọc thử nghiệm của AI Video.',
  'en':    'Hello! This is a test voice from AI Video.',
  'en-us': 'Hello! This is a test voice from AI Video.',
  'en-gb': 'Hello! This is a test voice from AI Video.',
  'en-au': 'Hello! This is a test voice from AI Video.',
  'zh-CN': '你好！这是 AI Video 的语音测试。',
  'zh-TW': '你好！這是 AI Video 的語音測試。',
  'ja':    'こんにちは！これは AI Video の音声テストです。',
  'ko':    '안녕하세요! 이것은 AI Video의 음성 테스트입니다.',
  'th':    'สวัสดี! นี่คือการทดสอบเสียงของ AI Video',
  'id':    'Halo! Ini adalah uji suara dari AI Video.',
  'ms':    'Helo! Ini adalah ujian suara daripada AI Video.',
  'hi':    'नमस्ते! यह AI Video का आवाज़ परीक्षण है।',
  'fr':    'Bonjour ! Ceci est un test vocal de AI Video.',
  'de':    'Hallo! Das ist ein Sprachtest von AI Video.',
  'es':    '¡Hola! Esta es una prueba de voz de AI Video.',
  'it':    'Ciao! Questo è un test vocale di AI Video.',
  'pt':    'Olá! Este é um teste de voz do AI Video.',
  'ru':    'Привет! Это голосовой тест от AI Video.',
  'nl':    'Hallo! Dit is een spraaktest van AI Video.',
  'pl':    'Cześć! To jest test głosu od AI Video.',
  'tr':    'Merhaba! Bu AI Video\'un ses testidir.',
  'ar':    'مرحباً! هذا اختبار صوتي من AI Video.',
};

$('testVoiceFreeBtn').addEventListener('click', async () => {
  const lang = ($('freeLangSelect') && $('freeLangSelect').value) || 'vi';
  const sample = LANG_SAMPLES[lang] || LANG_SAMPLES['vi'];
  await speakFreeTTS(sample);
});
$('testVoiceBtn').addEventListener('click', async () => {
  const voiceName = $('voiceSelect').selectedOptions[0]?.textContent || 'ElevenLabs';
  const success = await speakElevenLabs('Hello! This is a voice test from TuanDevTop. Xin chào, đây là giọng đọc thử nghiệm.');
  if (!success) {
    alert('Không thể phát giọng "' + voiceName.split('—')[0].trim() + '". Hãy kiểm tra API key ElevenLabs trong phần Cài đặt.');
  }
});

// ── Generate Script via SSE Stream ────────────────────────────────────────────
window.handleGenerate = async () => {
  const prompt = $('videoPrompt').value.trim();
  if (!prompt) return alert('Vui lòng nhập nội dung video!');

  // Resume audio context on user gesture
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const btn = $('generateScriptBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang kết nối AI Director...';

  const animStyle = $('animStyleSelect')?.value || 'ai';

  // Build SSE URL with query params
  const params = new URLSearchParams({ prompt, animStyle });
  const evtSource = new EventSource(`/api/generate-stream?${params.toString()}`);

  // Track received script and video assets
  let receivedScript = null;
  let videoAssets = []; // Array of { frame, videoUrl }

  // Show progress section
  progressSection.style.display = 'block';
  setProgress(5, '🎬 Đang kết nối Groq Director...');

  evtSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    setProgress(data.pct, data.label);
    btn.innerHTML = `<span class="spin"></span> ${data.label}`;
  });

  evtSource.addEventListener('script', (e) => {
    const data = JSON.parse(e.data);
    receivedScript = data.script;
  });

  evtSource.addEventListener('scene-ready', (e) => {
    const data = JSON.parse(e.data);
    // If the backend sends a videoUrl or imageUrl with the scene, collect it
    if (data.scene?.aiMediaUrl) {
      videoAssets.push({ frame: data.sceneIndex, url: data.scene.aiMediaUrl });
    }
    log(`Scene ${data.sceneIndex + 1} visual ready`);
  });

  evtSource.addEventListener('scene-error', (e) => {
    const data = JSON.parse(e.data);
    log(`Scene ${data.sceneIndex + 1} visual error: ${data.error}`, 'warn');
  });

  evtSource.addEventListener('complete', async (e) => {
    evtSource.close();
    const data = JSON.parse(e.data);
    currentScript = data.script;

    // ── Map video/image assets to scenes ──
    if (data.videoAssets && Array.isArray(data.videoAssets)) {
      data.videoAssets.forEach(asset => {
        const idx = asset.frame - 1; // frame is 1-indexed
        if (currentScript.scenes[idx]) {
          currentScript.scenes[idx].aiMediaUrl = asset.videoUrl || asset.imageUrl;
        }
      });
    }
    // Also map any assets collected during streaming
    videoAssets.forEach(asset => {
      if (currentScript.scenes[asset.frame]) {
        currentScript.scenes[asset.frame].aiMediaUrl = asset.url;
      }
    });

    // ── Preload all AI media assets before rendering ──
    const allMediaUrls = currentScript.scenes
      .map(s => s.aiMediaUrl)
      .filter(Boolean);

    if (allMediaUrls.length > 0) {
      setProgress(96, '📦 Đang tải tài nguyên media...');
      btn.innerHTML = '<span class="spin"></span> Đang tải media...';
      await renderer.preloadAssets(allMediaUrls, (loaded, total) => {
        const pct = 96 + (loaded / total) * 4;
        setProgress(pct, `📦 Đã tải ${loaded}/${total} tài nguyên`);
      });
    }

    // Reset button
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wand-2" style="width:15px;height:15px;"></i> Tạo video ngay';
    lucide.createIcons();

    canvasOverlay.classList.add('hidden');
    isPreviewMode = false;
    startCreation(true);
  });

  evtSource.addEventListener('error', (e) => {
    // Check if it's a custom error event or connection error
    if (e.data) {
      const data = JSON.parse(e.data);
      alert('Lỗi: ' + data.message);
    } else {
      // Connection error — EventSource auto-reconnects, but we close it
      alert('Lỗi kết nối đến server. Vui lòng thử lại.');
    }
    evtSource.close();

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wand-2" style="width:15px;height:15px;"></i> Tạo video ngay';
    lucide.createIcons();
    progressSection.style.display = 'none';
  });

  // Native EventSource error (connection lost)
  evtSource.onerror = () => {
    // Only handle if not already closed
    if (evtSource.readyState === EventSource.CLOSED) return;
    evtSource.close();

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wand-2" style="width:15px;height:15px;"></i> Tạo video ngay';
    lucide.createIcons();
    progressSection.style.display = 'none';
  };
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

/**
 * Speak text using the selected TTS engine.
 * Returns a Promise<number> that resolves with the audio duration in seconds.
 */
async function speakText(text) {
  if (activeTab === 'elevenlabs') {
    const result = await speakElevenLabs(text);
    if (result) return result;
  }
  return speakFreeTTS(text);
}

/**
 * Free TTS via Google Translate.
 * Resolves with audio duration in seconds, or 0 on failure.
 */
function speakFreeTTS(text) {
  return new Promise(async (resolve) => {
    try {
      const lang = ($('freeLangSelect') && $('freeLangSelect').value) || 'vi';
      const r = await fetch(`/api/tts-free?text=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}`);
      if (!r.ok) throw new Error('TTS Failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      audio.playbackRate = speechRate;
      activeAudio = audio;

      if (audioCtx && masterGain) {
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(masterGain);
      }

      audio.onended = () => { 
        const duration = audio.duration || 0;
        URL.revokeObjectURL(url); 
        activeAudio = null;
        resolve(duration); 
      };
      audio.onerror = () => {
        activeAudio = null;
        resolve(0);
      };
      audio.play();
    } catch (e) { 
      activeAudio = null;
      resolve(0); 
    }
  });
}

/**
 * ElevenLabs TTS.
 * Resolves with audio duration in seconds, or false on failure.
 */
function speakElevenLabs(text) {
  return new Promise(async (resolve) => {
    try {
      const voiceId = $('voiceSelect').value;
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (audioCtx && masterGain) {
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(masterGain);
      }

      audio.onended = () => { 
        const duration = audio.duration || 0;
        URL.revokeObjectURL(url); 
        activeAudio = null;
        resolve(duration); 
      };
      audio.onerror = () => {
        activeAudio = null;
        resolve(false);
      };
      await audio.play();
    } catch (e) { 
      activeAudio = null;
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
    
    currentAudioDestination = audioCtx.createMediaStreamDestination();
    masterGain = audioCtx.createGain();
    masterGain.connect(currentAudioDestination);
    masterGain.connect(audioCtx.destination); // Play to speakers too
    
    return currentAudioDestination.stream;
  } catch (e) { 
    return null; 
  }
}

// ── Main Video Creation Pipeline ──────────────────────────────────────────────
async function startCreation(withRecording) {
  if (!currentScript?.scenes?.length || isRunning) return;

  isRunning = true;
  recordedChunks = [];
  setButtonState('running');
  downloadSection.style.display = 'none';
  progressSection.style.display = 'block';
  canvasOverlay.classList.add('hidden');

  // Prepare scenes and global theme
  const scenes = currentScript.scenes;
  const globalTheme = currentScript.globalTheme || {
    colorPalette: ['#ffffff', '#888888', '#000000'],
    mood: 'intense',
    fontStyle: 'bold-impact',
    transitionStyle: 'crossfade'
  };

  renderer.setScenes(scenes, globalTheme);

  let recorder = null;
  if (withRecording) {
    try {
      const canvasStream = canvas.captureStream(30);
      const audioStream = await setupAudioCapture();
      let combinedStream = audioStream ? new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]) : canvasStream;
      
      recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm', videoBitsPerSecond: 6000000 });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
      recorder.onstop = () => {
        videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        downloadLink.href = URL.createObjectURL(videoBlob);
        downloadLink.download = `VIDEO_AI_${Date.now()}.webm`;
        downloadSection.style.display = 'block';
        downloadSection.scrollIntoView({ behavior: 'smooth' });
      };
      recorder.start(100);
      mediaRecorder = recorder;
    } catch (e) { withRecording = false; }
  }

  // ── Scene Loop ─────────────────────────────────────────────────────────────
  for (let i = 0; i < scenes.length; i++) {
    if (!isRunning) break;
    const scene = scenes[i];
    
    // Update Progress
    const pct = Math.floor((i / scenes.length) * 100);
    setProgress(pct, `Đang tạo cảnh ${i + 1}/${scenes.length}: "${scene.sceneTitle}"`);

    // 1. Handle Hook (Scene 1 only)
    if (i === 0 && scene.hookType && scene.hookType !== 'none') {
      await handleHookEffect(scene.hookType, scene.accentColor);
    }

    // 2. Start audio and renderer in parallel.
    //    The renderer runs a rAF loop; audio plays independently.
    //    We wait for BOTH to finish. If the video asset is shorter than the
    //    audio, the renderer loops the video (video.loop = true by default).
    //    If audio finishes first, the renderer keeps drawing until its
    //    duration expires. We use the longer of the two as the scene duration.

    // Launch audio — resolves when narration ends, returns duration in seconds
    const audioPromise = speakText(scene.narration);

    // Launch renderer — resolves when scene.estimatedDuration expires
    const renderPromise = new Promise(resolve => {
      renderer.renderScene(scene, globalTheme, resolve);
    });

    // Wait for both to complete
    const [audioDuration] = await Promise.all([audioPromise, renderPromise]);

    // If the audio was longer than estimatedDuration, the renderer already
    // stopped but audio was still playing. To handle this: if we detect the
    // audio ran past the render, we extend by re-starting the render for
    // the remaining time. In practice, since we wait for both Promises,
    // the audio promise won't resolve until the audio finishes playing.
    // The renderer completes at estimatedDuration, and audio at its own pace,
    // so whichever finishes last determines when the loop moves to next scene.

    if (!isRunning) break;
  }

  if (isRunning) {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    isRunning = false;
    setButtonState('done');
    progressSection.style.display = 'none';
    lucide.createIcons();
  }
}

async function handleHookEffect(type, color) {
  return new Promise(async resolve => {
    renderer.clear();
    const ctx = canvas.getContext('2d');
    
    if (type === 'dramatic-countdown') {
      for (let n = 3; n > 0; n--) {
        renderer.clear();
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = color || '#fff';
        ctx.font = 'bold 200px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n, canvas.width/2, canvas.height/2);
        await new Promise(r => setTimeout(r, 800));
      }
    } else if (type === 'shocking-stat') {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 120px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("ATTENTION!", canvas.width/2, canvas.height/2);
      await new Promise(r => setTimeout(r, 1200));
    }
    resolve();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await checkApiStatus();
  loadVoices();
  lucide.createIcons();
})();
