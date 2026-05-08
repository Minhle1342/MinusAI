

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
  await speakText('Xin chào! Đây là giọng đọc thử nghiệm của TuanDevTop.');
});
$('testVoiceBtn').addEventListener('click', async () => {
  await speakText('Xin chào! Đây là giọng đọc của ElevenLabs.');
});

// ── Generate Script & Auto-Start ──────────────────────────────────────────────
window.handleGenerate = async () => {
  const basePrompt = $('videoPrompt').value.trim();
  if (!basePrompt) return alert('Vui lòng nhập nội dung video!');

  const sceneCount = parseInt(document.getElementById('scene-count-slider').value) || 6;

  let prompt = basePrompt + `\n\nEach scene may contain a "renderMode" field with the values: "default", "glitch", "hand-drawn", "neon", "retro".\n\nChoose renderMode based on scene content:\n- "glitch": technology, hacking, security, AI, error-related scenes\n- "hand-drawn": ideas, creativity, educational explanations, conceptual scenes\n- "neon": opening titles, CTA scenes, major highlights\n- "retro": history, nostalgia, before/after comparisons\n- "default": normal scenes\n\nNot every scene needs a non-default renderMode.\n\nEach scene may contain an "elements" field — an array of up to 3 visual elements.\n\nOnly add elements when the scene contains numbers, statistics, or concrete comparisons.\nDo not add elements to intro scenes or ending scenes.\n\nElement types:\n\n- "stat-counter"\n  Use when there is a single highlighted number (revenue, users, percentages, etc.)\n  Required fields: type, label, value (number), position\n  Optional fields: prefix (default ""), suffix (default "")\n\n- "progress-bar"\n  Use when there is a percentage or completion metric\n  Required fields: type, label, percent (0-100), position\n\n- "chart"\n  Use when multiple data points need comparison (minimum 3 points)\n  Required fields:\n    type,\n    chartType ("bar" or "line"),\n    label,\n    data (array of {label, value}),\n    position\n\n  Maximum 6 data points.\n\nValid positions: "bottom-left", "bottom-center", "bottom-right", "center-left", "center-right". Maximum 3 elements per scene, no duplicated positions.\nDo not invent statistics — only use numbers provided by the user or numbers that reasonably match the content context.`;

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    
    const data = await r.json();
    if (!data.success) throw new Error(data.error);

    currentScript = data.script;

    if (currentScript.scenes && currentScript.scenes.length !== sceneCount) {
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

      if (audioCtx && masterGain) {
        const source = audioCtx.createMediaElementSource(audio);
        source.connect(masterGain);
      }

      audio.onended = () => { 
        URL.revokeObjectURL(url); 
        activeAudio = null;
        resolve(true); 
      };
      audio.onerror = () => {
        activeAudio = null;
        resolve(false);
      };
      audio.play();
    } catch (e) { 
      activeAudio = null;
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
        URL.revokeObjectURL(url); 
        activeAudio = null;
        resolve(true); 
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

  const scenes = currentScript.scenes.map(s => ({ ...s, videoTitle: currentScript.videoTitle || '' }));
  renderer.setScenes(scenes);

  let recorder = null;
  if (withRecording) {
    try {
      const canvasStream = canvas.captureStream(30);
      const audioStream = await setupAudioCapture();
      let combinedStream = audioStream ? new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]) : canvasStream;
      
      recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm', videoBitsPerSecond: 4000000 });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
      recorder.onstop = () => {
        videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        downloadLink.href = URL.createObjectURL(videoBlob);
        downloadLink.download = `TuanDevTop_${Date.now()}.webm`;
        downloadSection.style.display = 'block';
        downloadSection.scrollIntoView({ behavior: 'smooth' });
      };
      recorder.start(100);
      mediaRecorder = recorder;
    } catch (e) { withRecording = false; }
  }

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
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    isRunning = false;
    setButtonState('done');
    progressSection.style.display = 'none';
  }
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
  await checkApiStatus();
  loadVoices();
  lucide.createIcons();
})();
