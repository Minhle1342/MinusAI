

const $ = (id) => document.getElementById(id);

/**
 * Macrotask Yielding strategy using MessageChannel.
 * Bypasses Background Tab Throttling (setTimeout/requestAnimationFrame are capped to 1fps in background).
 * MessageChannel maintains priority and runs as fast as possible.
 */
const yieldControl = () => new Promise(resolve => {
  const channel = new MessageChannel();
  channel.port1.onmessage = resolve;
  channel.port2.postMessage(null);
});

// ── DOM References ────────────────────────────────────────────────────────────
const canvas = $('videoCanvas');
const canvasOverlay = $('canvasOverlay');
const generateBtn = $('generateScriptBtn');
const playStopBtn = $('playStopBtn');
const playStopIcon = $('playStopIcon');
const resetBtn = $('resetBtn');
const progressSection = $('progressSection');
const progressBar = $('progressBar');
const progressPct = $('progressPct');
const progressLabel = $('progressLabel');
const scenesList = $('scenesList');
const scriptPanel = $('scriptPanel');
const downloadSection = $('downloadSection');
const downloadLink = $('downloadLink');
const logPanel = $('logPanel');
const btnGenerateNews = $('btnGenerateNews');
const newsLoadingStatus = $('newsLoadingStatus');
const newsLoadingText = $('newsLoadingText');

// Storyboard Buttons
const storyboardRenderBtn = $('storyboardRenderBtn');
const storyboardPreviewBtn = $('storyboardPreviewBtn');
const storyboardCollapseBtn = $('storyboardCollapseBtn');
const storyboardEditAllBtn = $('storyboardEditAllBtn');

let newsLoadingInterval = null;
const newsMessages = [
  "🔍 Đang săn tìm tin tức nóng hổi trên toàn cầu...",
  "🌐 Đang kết nối với các nguồn báo uy tín...",
  "📄 Đang đọc và phân tích nội dung chuyên sâu...",
  "🧠 AI đang chắt lọc thông tin quan trọng nhất...",
  "✍️ Đang biên tập kịch bản video chuyên nghiệp...",
  "🎬 Đang chuẩn bị các cảnh quay tối ưu..."
];

// ── i18n Translations ─────────────────────────────────────────────────────────
const i18n = {
  vi: {
    app_title: "Minus",
    panel_title: "Tạo Video AI",
    tab_standard: "Tự soạn",
    tab_news: "Săn tin tức",
    label_prompt: "Nội dung video bạn muốn tạo",
    placeholder_prompt: "VD: Tạo video giới thiệu về trí tuệ nhân tạo...",
    label_style: "Phong cách video",
    label_scenes: "Số khung hình (Scenes)",
    btn_generate: "Tạo video ngay",
    label_news_topic: "Chủ đề tin tức muốn săn",
    placeholder_news_topic: "VD: Đột phá AI mới nhất, Thị trường chứng khoán...",
    btn_hunt: "Săn tin & Làm Video",
    tab_url: "Link bài báo",
    label_article_url: "Dán link bài báo (https://...)",
    placeholder_article_url: "https://example.com/news/article",
    btn_url_hunt: "Làm Video từ Link",
    msg_scraping_url: "🌐 Đang cào dữ liệu từ bài báo...",
    panel_audio_title: "Giọng đọc",
    tab_free: "Miễn phí",
    alert_voice_free: "Giọng đọc Tiếng Việt chất lượng cao.",
    label_speech_rate: "Tốc độ đọc",
    label_slow: "Chậm",
    label_fast: "Nhanh",
    btn_test_voice: "Nghe thử mẫu",
    label_voice_select: "Chọn giọng",
    canvas_placeholder_title: "Video hiển thị tại đây!",
    canvas_placeholder_desc: "Nhập nội dung và bắt đầu tạo ngay video chuyên nghiệp",
    label_generating: "Đang tạo...",
    btn_new_session: "Phiên mới",
    download_ready_title: "Video đã sẵn sàng!",
    btn_download: "Tải xuống",
    btn_reset: "Làm lại",
    settings_title: "Cài đặt hệ thống",
    settings_gemini: "Gemini API Key",
    settings_eleven: "ElevenLabs API Key",
    settings_save: "Lưu cài đặt",
    msg_search_news: "🔍 Đang săn tìm tin tức nóng hổi trên toàn cầu...",
    msg_connect_sources: "🌐 Đang kết nối với các nguồn báo uy tín...",
    msg_analyze_content: "📄 Đang đọc và phân tích nội dung chuyên sâu...",
    msg_ai_extract: "🧠 AI đang chắt lọc thông tin quan trọng nhất...",
    msg_edit_script: "✍️ Đang biên tập kịch bản video chuyên nghiệp...",
    msg_prepare_scenes: "🎬 Đang chuẩn bị các cảnh quay tối ưu...",
    
    // New keys
    label_orientation: "Định dạng video",
    orientation_landscape: "Ngang 16:9",
    orientation_portrait: "Dọc 9:16",
    style_auto: "Để AI tự chọn",
    style_cinematic: "Cinematic — Điện ảnh",
    style_educational: "Educational — Giáo dục",
    style_promotional: "Promotional — Quảng bá",
    style_documentary: "Documentary — Tài liệu",
    style_motivational: "Motivational — Truyền cảm hứng",
    storyboard_title: "Bảng phân cảnh",
    storyboard_apply_all: "Áp dụng giọng đọc cho tất cả",
    storyboard_preview: "Xem thử (không lưu)",
    storyboard_render: "Chốt! Render Video",
    tab_edge: "Edge TTS",
    edge_info: "322+ giọng đọc neural — miễn phí, không cần API key.",
    edge_voice: "Giọng đọc",
    edge_style: "Phong cách đọc",
    style_default: "Mặc định",
    style_serious: "Nghiêm túc",
    style_energetic: "Năng động",
    style_calm: "Bình tĩnh",
    style_cheerful: "Vui vẻ",
    style_news: "Phong cách bản tin",
    download_desc: "Bạn có thể tải xuống hoặc đăng trực tiếp lên YouTube.",
    yt_connect_msg: "Kết nối tài khoản YouTube để đăng video trực tiếp.",
    yt_btn_connect: "Kết nối YouTube",
    yt_btn_disconnect: "Ngắt kết nối",
    yt_label_title: "Tiêu đề video",
    yt_placeholder_title: "Để trống = dùng tiêu đề AI tạo ra",
    yt_label_desc: "Mô tả",
    yt_placeholder_desc: "Mô tả video (tùy chọn)",
    yt_label_tags: "Tags (phân cách bằng dấu phẩy)",
    yt_placeholder_tags: "AI, video, tin tức, ...",
    yt_label_privacy: "Quyền riêng tư",
    privacy_public: "Công khai",
    privacy_unlisted: "Không công khai (có link)",
    privacy_private: "Riêng tư",
    yt_shorts_msg: "📱 Chế độ YouTube Shorts tự động được bật",
    yt_btn_upload: "Đăng lên YouTube",
    yt_msg_uploading: "Đang tải lên...",
    yt_msg_success: "Video của bạn đã được đăng thành công!",
    yt_btn_view: "Xem video",
    yt_btn_view_shorts: "Xem Shorts",
    tab_api_keys: "API Keys",
    tab_quota: "Hạn mức",
    quota_loading: "Đang tải thông tin hạn mức...",
    settings_jina: "Jina API Key",
    placeholder_jina: "Dùng cho Article URL to Video",
    alert_no_url: "Vui lòng dán link bài báo!",
    alert_invalid_url: "URL phải bắt đầu bằng http:// hoặc https://",
    alert_save_error: "Lỗi khi lưu: ",
    alert_save_success: "Đã lưu cài đặt thành công!",
    alert_no_topic: "Vui lòng nhập chủ đề tin tức!",
    alert_no_prompt: "Vui lòng nhập nội dung video!",
    alert_error: "Lỗi: ",
    alert_gen_error: "Đã xảy ra lỗi trong quá trình tạo video.",
    alert_voice_applied: "Đã áp dụng cài đặt giọng đọc hiện tại cho toàn bộ các cảnh quay.",
    alert_yt_connect_failed: "Kết nối YouTube thất bại: ",
    alert_yt_auth_error: "Không thể tạo link đăng nhập YouTube: ",
    alert_no_video: "Chưa có video để tải lên. Hãy render video trước.",
    alert_yt_upload_error: "Lỗi khi đăng lên YouTube: ",
    tooltip_play_stop: "Xem thử / Dừng",
    tooltip_collapse: "Thu gọn",
    tooltip_settings: "Cài đặt hệ thống"
  },
  en: {
    app_title: "Minus",
    panel_title: "Create Video AI",
    tab_standard: "Standard",
    tab_news: "News Hunter",
    label_prompt: "Video Content Prompt",
    placeholder_prompt: "e.g., Create a video introducing AI...",
    label_style: "Video Style",
    label_scenes: "Number of Scenes",
    btn_generate: "Create Video Now",
    label_news_topic: "News Topic to Hunt",
    placeholder_news_topic: "e.g., Latest AI Breakthroughs, Stock Market...",
    btn_hunt: "Hunt & Create Video",
    tab_url: "Article Link",
    label_article_url: "Paste Article Link (https://...)",
    placeholder_article_url: "https://example.com/news/article",
    btn_url_hunt: "Make Video from Link",
    msg_scraping_url: "🌐 Scraping article content...",
    panel_audio_title: "Voice",
    tab_free: "Free",
    alert_voice_free: "High quality Vietnamese/English voices.",
    label_speech_rate: "Speech Rate",
    label_slow: "Slow",
    label_fast: "Fast",
    btn_test_voice: "Test Voice",
    label_voice_select: "Select Voice",
    canvas_placeholder_title: "Video will appear here!",
    canvas_placeholder_desc: "Enter a prompt and start creating professional videos",
    label_generating: "Generating...",
    btn_new_session: "New Session",
    download_ready_title: "Video is Ready!",
    btn_download: "Download",
    btn_reset: "Reset",
    settings_title: "System Settings",
    settings_gemini: "Gemini API Key",
    settings_eleven: "ElevenLabs API Key",
    settings_save: "Save Settings",
    msg_search_news: "🔍 Hunting for breaking news globally...",
    msg_connect_sources: "🌐 Connecting to trusted news sources...",
    msg_analyze_content: "📄 Reading and analyzing in-depth content...",
    msg_ai_extract: "🧠 AI is extracting key information...",
    msg_edit_script: "✍️ Editing professional video script...",
    msg_prepare_scenes: "🎬 Preparing optimized scenes...",
    
    // New keys
    label_orientation: "Video Format",
    orientation_landscape: "Landscape 16:9",
    orientation_portrait: "Portrait 9:16",
    style_auto: "Let AI choose",
    style_cinematic: "Cinematic",
    style_educational: "Educational",
    style_promotional: "Promotional",
    style_documentary: "Documentary",
    style_motivational: "Motivational",
    storyboard_title: "Storyboard",
    storyboard_apply_all: "Apply voice to all",
    storyboard_preview: "Preview (unsaved)",
    storyboard_render: "Render Video",
    tab_edge: "Edge TTS",
    edge_info: "322+ neural voices — free, no API key needed.",
    edge_voice: "Voice",
    edge_style: "Reading Style",
    style_default: "Default",
    style_serious: "Serious",
    style_energetic: "Energetic",
    style_calm: "Calm",
    style_cheerful: "Cheerful",
    style_news: "News Style",
    download_desc: "You can download or post directly to YouTube.",
    yt_connect_msg: "Connect your YouTube account to post videos directly.",
    yt_btn_connect: "Connect YouTube",
    yt_btn_disconnect: "Disconnect",
    yt_label_title: "Video Title",
    yt_placeholder_title: "Leave blank = use AI title",
    yt_label_desc: "Description",
    yt_placeholder_desc: "Video description (optional)",
    yt_label_tags: "Tags (comma separated)",
    yt_placeholder_tags: "AI, video, news, ...",
    yt_label_privacy: "Privacy",
    privacy_public: "Public",
    privacy_unlisted: "Unlisted (link only)",
    privacy_private: "Private",
    yt_shorts_msg: "📱 YouTube Shorts mode automatically enabled",
    yt_btn_upload: "Post to YouTube",
    yt_msg_uploading: "Uploading...",
    yt_msg_success: "Your video has been posted successfully!",
    yt_btn_view: "View Video",
    yt_btn_view_shorts: "View Shorts",
    tab_api_keys: "API Keys",
    tab_quota: "Quota",
    quota_loading: "Loading quota info...",
    settings_jina: "Jina API Key",
    placeholder_jina: "Used for Article URL to Video",
    alert_no_url: "Please paste an article URL!",
    alert_invalid_url: "URL must start with http:// or https://",
    alert_save_error: "Save error: ",
    alert_save_success: "Settings saved successfully!",
    alert_no_topic: "Please enter a news topic!",
    alert_no_prompt: "Please enter video content!",
    alert_error: "Error: ",
    alert_gen_error: "An error occurred during video generation.",
    alert_voice_applied: "Current voice settings applied to all scenes.",
    alert_yt_connect_failed: "YouTube connection failed: ",
    alert_yt_auth_error: "Could not create YouTube login link: ",
    alert_no_video: "No video to upload. Please render the video first.",
    alert_yt_upload_error: "Error uploading to YouTube: ",
    tooltip_play_stop: "Preview / Stop",
    tooltip_collapse: "Collapse",
    tooltip_settings: "System Settings"
  }
};

let currentLang = localStorage.getItem('appLang') || 'vi';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('appLang', lang);

  // Update Buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === lang) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Update Elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang][key]) {
      // Preserve icon if present
      const icon = el.querySelector('i');
      if (icon) {
        el.innerHTML = '';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + i18n[lang][key]));
      } else {
        el.textContent = i18n[lang][key];
      }
    }
  });

  // Update Tooltips with data-i18n-tooltip
  document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    const key = el.dataset.i18n_tooltip || el.getAttribute('data-i18n-tooltip');
    if (i18n[lang][key]) {
      el.setAttribute('data-tooltip', i18n[lang][key]);
    }
  });

  // Update Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18n_placeholder || el.getAttribute('data-i18n-placeholder');
    if (i18n[lang][key]) {
      el.placeholder = i18n[lang][key];
    }
  });

  // Update news loading messages
  updateNewsMessages(lang);
}

function updateNewsMessages(lang) {
  newsMessages[0] = i18n[lang].msg_search_news;
  newsMessages[1] = i18n[lang].msg_connect_sources;
  newsMessages[2] = i18n[lang].msg_analyze_content;
  newsMessages[3] = i18n[lang].msg_ai_extract;
  newsMessages[4] = i18n[lang].msg_edit_script;
  newsMessages[5] = i18n[lang].msg_prepare_scenes;
}

// Init Language on Load
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang) setLanguage(lang);
    });
  });
});

// ── State ─────────────────────────────────────────────────────────────────────
let renderer = null;
let currentScript = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRunning = false;
let isPreviewMode = false;
let videoBlob = null;
let activeTab = 'free';
let speechRate = 1.0;

let activeAudio = null;
let currentOrientation = 'landscape';

// ── YouTube State ─────────────────────────────────────────────────────────────
let ytAuthenticated = false;

// ── Orientation Handling ──────────────────────────────────────────────────────
const orientations = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 }
};

function setOrientation(mode) {
  currentOrientation = mode;
  const dims = orientations[mode];
  
  // Update UI state
  document.querySelectorAll('.orientation-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.orientation === mode);
  });

  // Resize canvas
  canvas.width = dims.w;
  canvas.height = dims.h;

  // Update renderer
  if (renderer) {
    renderer.W = dims.w;
    renderer.H = dims.h;
    renderer.initParticles();
    renderer.drawIdleScreen();
  }
}

document.querySelectorAll('.orientation-btn').forEach(btn => {
  btn.addEventListener('click', () => setOrientation(btn.dataset.orientation));
});

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
  if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
  return headers;
}

/**
 * Preload AI-generated images for all scenes concurrently.
 * This ensures no frame drops or SecurityErrors during render.
 */
async function preloadSceneImages(scenes) {
  let loadedCount = 0;
  const scriptMedia = currentScript?._articleMedia || {};
  const total = scenes.filter(s => s.imagePrompt).length;

  // 1. Preload Article Thumbnail for scene 0 if applicable
  if (scenes[0] && scriptMedia.thumbnail && !scenes[0].videoScene && !scenes[0].loadedImage) {
    try {
      const thumbUrl = `/api/proxy-image?url=${encodeURIComponent(scriptMedia.thumbnail)}`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => {
          console.warn("Failed to preload article thumbnail, continuing with default background.");
          resolve(); // Resolve to not block everything
        };
        img.src = thumbUrl;
      });
      if (img.complete && img.naturalWidth > 0) {
        scenes[0].loadedImage = img;
      }
    } catch (e) {
      console.warn("Thumbnail preload error:", e);
    }
  }

  for (const [index, scene] of scenes.entries()) {
    if (!scene.imagePrompt) continue;

    try {
      loadedCount++;
      const currentProgress = 5 + (loadedCount / total) * 10;
      setProgress(currentProgress, `Đang chuẩn bị hình ảnh cho cảnh ${loadedCount}/${total}...`);
      
      // Sequential loading with a gap to respect limits
      if (index > 0) await new Promise(r => setTimeout(r, 1500));

      let query = '';
      if (scene.youtubeId) {
        // Use proxy for YouTube thumbnail
        const ytUrl = `https://img.youtube.com/vi/${scene.youtubeId}/maxresdefault.jpg`;
        query = `url=${encodeURIComponent(ytUrl)}`;
      } else {
        query = `prompt=${encodeURIComponent(scene.imagePrompt)}`;
      }

      let response;
      let success = false;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
          response = await fetch(`/api/scene-image?${query}`);
          if (response.ok) {
            success = true;
            break;
          }
        } catch (e) {
          console.warn(`Retry ${attempt + 1} for scene ${index + 1} image failed`);
        }
      }

      if (!success) throw new Error("Image proxy failed after retries");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      scene.loadedImage = img;
    } catch (err) {
      console.error(`Image preload failed for scene ${index + 1}:`, err);
    }
  }
}

// ── Settings Modal ────────────────────────────────────────────────────────────
$('settingsBtn').addEventListener('click', () => {
  $('geminiKeyInput').value = localStorage.getItem('geminiKey') || '';
  $('jinaKeyInput').value = localStorage.getItem('jinaKey') || '';
  
  // Reset to first tab
  document.querySelectorAll('#settingsModal .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#settingsModal .tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('#settingsModal .tab-btn[data-tab="settings-api"]').classList.add('active');
  $('settings-api').classList.add('active');
  
  $('settingsModal').classList.add('open');
});

$('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.remove('open'));

$('saveSettingsBtn').addEventListener('click', async () => {
  const geminiKey = $('geminiKeyInput').value.trim();
  const jinaKey = $('jinaKeyInput').value.trim();

  try {
    localStorage.setItem('geminiKey', geminiKey);
    localStorage.setItem('jinaKey', jinaKey);
    $('settingsModal').classList.remove('open');
    alert(i18n[currentLang].alert_save_success);
  } catch (e) { alert(i18n[currentLang].alert_save_error + e.message); }
});

// Quota Tab Listener
$('tabQuotaBtn')?.addEventListener('click', () => {
  fetchQuota();
});

async function fetchQuota() {
  const quotaContainer = $('quotaContainer');
  quotaContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);"><span class="spin" style="border-top-color:var(--text-primary); margin-bottom:1rem;"></span><br>Đang tải thông tin hạn mức...</div>';
  
  try {
    const res = await fetch('/api/quota', {
      headers: {
        'x-gemini-key': localStorage.getItem('geminiKey') || '',
        'x-jina-key': localStorage.getItem('jinaKey') || ''
      }
    });
    const data = await res.json();
    
    quotaContainer.innerHTML = '';
    
    // 1. Google Gemini
    const geminiSection = document.createElement('div');
    geminiSection.className = 'quota-card';
    geminiSection.innerHTML = `
      <div style="font-weight:600; font-size:0.9rem; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
        <i data-lucide="brain" style="width:16px;height:16px;"></i> Google Gemini
      </div>
      <div class="panel" style="padding:1rem; background:rgba(28,28,28,0.02); border-radius:12px;">
        <div style="display:flex; justify-content:space-between; font-size:0.875rem; margin-bottom:0.5rem;">
          <span style="color:var(--text-muted);">Trạng thái:</span>
          <span style="font-weight:600; color:${data.gemini.status === 'Active' ? 'var(--success)' : 'var(--danger)'}">${data.gemini.status}</span>
        </div>
        ${data.gemini.error ? `<div style="font-size:0.75rem; color:var(--danger); margin-top:0.5rem; background:rgba(239,68,68,0.05); padding:8px; border-radius:6px; border:1px solid rgba(239,68,68,0.1);">${data.gemini.error}</div>` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem; line-height:1.4;">${data.gemini.usage?.info || ''}</div>
      </div>
    `;
    quotaContainer.appendChild(geminiSection);

    // 2. Jina AI
    const jinaSection = document.createElement('div');
    jinaSection.className = 'quota-card';
    const jinaUsage = data.jina.usage || {};
    const jinaStatus = data.jina.status;
    const jinaRemaining = jinaUsage.remaining || 'N/A';

    jinaSection.innerHTML = `
      <div style="font-weight:600; font-size:0.9rem; margin-bottom:0.75rem; display:flex; align-items:center; justify-content:space-between; margin-top:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="search" style="width:16px;height:16px;"></i> Jina AI
        </div>
        <a href="https://jina.ai/reader/" target="_blank" style="font-size:0.7rem; color:var(--primary); text-decoration:none; display:flex; align-items:center; gap:0.25rem;">
          Dashboard <i data-lucide="external-link" style="width:10px;height:10px;"></i>
        </a>
      </div>
      <div class="panel" style="padding:1rem; background:rgba(28,28,28,0.02); border-radius:12px;">
        <div style="display:flex; justify-content:space-between; font-size:0.875rem; margin-bottom:0.5rem;">
          <span style="color:var(--text-muted);">Trạng thái:</span>
          <span style="font-weight:600; color:${jinaStatus === 'Active' ? 'var(--success)' : 'var(--danger)'}">${jinaStatus}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.875rem;">
          <span style="color:var(--text-muted);">Hạn mức còn lại (RPM):</span>
          <span style="font-weight:600;">${jinaRemaining}</span>
        </div>
        
        ${data.jina.error ? `<div style="font-size:0.75rem; color:var(--danger); margin-top:0.75rem; background:rgba(239,68,68,0.05); padding:8px; border-radius:6px; border:1px solid rgba(239,68,68,0.1);">${data.jina.error}</div>` : ''}
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.75rem; font-style:italic;">
          Jina không cung cấp API số dư. Vui lòng xem chi tiết tại Dashboard.
        </div>
      </div>
    `;
    quotaContainer.appendChild(jinaSection);
    
    // Add Gemini Dashboard link to Gemini section (it's already there in the DOM at this point)
    const geminiHeader = geminiSection.querySelector('div');
    if (geminiHeader) {
      const link = document.createElement('a');
      link.href = "https://aistudio.google.com/app/plan_management";
      link.target = "_blank";
      link.style = "font-size:0.7rem; color:var(--primary); text-decoration:none; display:flex; align-items:center; gap:0.25rem; margin-left:auto;";
      link.innerHTML = 'Dashboard <i data-lucide="external-link" style="width:10px;height:10px;"></i>';
      geminiHeader.appendChild(link);
    }

    if (window.lucide) lucide.createIcons();
    
  } catch (e) {
    quotaContainer.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--danger); background:rgba(239,68,68,0.05); border-radius:12px; border:1px solid rgba(239,68,68,0.1);">Không thể lấy thông tin hạn mức: ${e.message}</div>`;
  }
}

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

// ── Storyboard UI ─────────────────────────────────────────────────────────────
function showStoryboard(script) {
  currentScript = script;

  // Set video title in header
  const titleEl = $('storyboardVideoTitle');
  if (titleEl) titleEl.textContent = script.videoTitle || 'Bảng phân cảnh';

  const countEl = $('storyboardSceneCount');
  if (countEl) countEl.textContent = `${script.scenes.length} cảnh`;

  const container = $('storyboardCards');
  container.innerHTML = '';

  const media = script._articleMedia || {};

  script.scenes.forEach((scene, idx) => {
    const isVideoScene = !!scene.videoScene && (media.youtubeId || media.videoUrl);
    
    // Element badge HTML
    let elementBadgeHTML = '';
    if (scene.elements?.length > 0) {
      const el = scene.elements[0];
      const typeLabels = {
        'stat-counter': '📊 Stat Counter',
        'progress-bar': '📈 Progress Bar',
        'chart': `📉 Chart (${el.chartType || 'bar'})`
      };
      elementBadgeHTML = `
        <div class="sb-element-badge">
          ${typeLabels[el.type] || el.type}
          ${el.label ? `— ${el.label}` : ''}
        </div>`;
    }

    const card = document.createElement('div');
    card.className = `storyboard-card ${isVideoScene ? 'sb-card-video' : ''}`;
    card.dataset.sceneIdx = idx;
    
    // Video-specific UI
    let videoUI = '';
    if (isVideoScene) {
      const videoType = media.youtubeId ? 'YouTube' : 'Direct MP4';
      videoUI = `
        <div class="sb-video-meta">
          <div class="badge badge-video"><i data-lucide="video"></i> ${videoType} Scene</div>
          <div class="sb-video-settings">
            <div class="v-input-group">
              <label>Bắt đầu (giây)</label>
              <input type="number" class="sb-v-start" value="${scene.videoStart || 0}" step="1" min="0" data-idx="${idx}">
            </div>
            <div class="v-input-group">
              <label>Kết thúc (giây)</label>
              <input type="number" class="sb-v-end" value="${scene.videoEnd || 10}" step="1" min="1" data-idx="${idx}">
            </div>
          </div>
        </div>
      `;
    } else if (idx === 0 && media.thumbnail) {
      // Show thumbnail preview on scene 1 if not a video scene
      videoUI = `
        <div class="sb-thumbnail-preview">
          <img src="/api/proxy-image?url=${encodeURIComponent(media.thumbnail)}" alt="Article Thumbnail">
          <span class="badge badge-sm">Sử dụng Thumbnail làm nền</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="sb-scene-num">${idx + 1}</div>
      <div class="sb-scene-content">
        <div class="sb-scene-title">${scene.sceneTitle || '—'}</div>
        <div class="sb-scene-text">${scene.textContent || ''}</div>
        ${videoUI}
        <div
          class="sb-scene-narration"
          contenteditable="false"
          data-scene-idx="${idx}"
          title="Click để chỉnh sửa lời đọc"
        >${scene.narration || ''}</div>
        ${elementBadgeHTML}
      </div>`;

    container.appendChild(card);
  });

  // Wire up narration edit
  container.querySelectorAll('.sb-scene-narration').forEach(el => {
    el.addEventListener('click', () => {
      el.contentEditable = 'true';
      el.focus();
    });
    el.addEventListener('blur', () => {
      const idx = parseInt(el.dataset.sceneIdx);
      if (!isNaN(idx) && currentScript?.scenes?.[idx]) {
        currentScript.scenes[idx].narration = el.textContent.trim();
      }
      el.contentEditable = 'false';
    });
  });

  // Wire up video timestamp inputs
  container.querySelectorAll('.sb-v-start, .sb-v-end').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const val = parseFloat(e.target.value);
      if (e.target.classList.contains('sb-v-start')) {
        currentScript.scenes[idx].videoStart = val;
      } else {
        currentScript.scenes[idx].videoEnd = val;
      }
    });
  });

  // Show the panel
  $('storyboardPanel').style.display = 'block';
  $('storyboardPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });

  playStopBtn.disabled = false;
  setButtonState('ready');
  if (window.lucide) lucide.createIcons();
}

// ── News Hunter Logic ─────────────────────────────────────────────────────────
async function handleNewsHunter() {
  const topic = $('newsTopicInput').value.trim();
  if (!topic) return alert(i18n[currentLang].alert_no_topic);

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
      body: JSON.stringify({ topic, orientation: currentOrientation })
    });

    const data = await r.json();
    if (data.error) throw new Error(data.error);

    // Stop loading
    clearInterval(newsLoadingInterval);
    newsLoadingStatus.classList.add('hidden');
    btnGenerateNews.disabled = false;

    // Show storyboard instead of auto-starting
    showStoryboard(data);
  } catch (e) {
    clearInterval(newsLoadingInterval);
    newsLoadingText.style.color = "var(--text-primary)";
    btnGenerateNews.disabled = false;
    setTimeout(() => {
      newsLoadingStatus.classList.add('hidden');
    }, 5000);
  }
}

if (btnGenerateNews) {
  btnGenerateNews.addEventListener('click', handleNewsHunter);
}

// ── Article URL Logic ────────────────────────────────────────────────────────
async function handleUrlToVideo() {
  const articleUrl = $('articleUrlInput').value.trim();
  if (!articleUrl) return alert(i18n[currentLang].alert_no_url);
  
  if (!articleUrl.startsWith('http')) {
    return alert(i18n[currentLang].alert_invalid_url);
  }

  const btn = $('btnGenerateFromUrl');
  btn.disabled = true;
  newsLoadingStatus.classList.remove('hidden');
  let msgIdx = 0;
  
  // Custom first message for URL mode
  newsLoadingText.textContent = i18n[currentLang].msg_scraping_url;

  newsLoadingInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % newsMessages.length;
    newsLoadingText.textContent = newsMessages[msgIdx];
  }, 6000);

  try {
    const r = await fetch('/api/url-to-video', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ articleUrl, orientation: currentOrientation })
    });

    const data = await r.json();
    if (data.error) throw new Error(data.error);

    clearInterval(newsLoadingInterval);
    newsLoadingStatus.classList.add('hidden');
    btn.disabled = false;

    showStoryboard(data);
  } catch (e) {
    clearInterval(newsLoadingInterval);
    newsLoadingText.style.color = "var(--text-primary)";
    btn.disabled = false;
    setTimeout(() => {
      newsLoadingStatus.classList.add('hidden');
    }, 5000);
  }
}

const btnGenerateFromUrl = $('btnGenerateFromUrl');
if (btnGenerateFromUrl) {
  btnGenerateFromUrl.addEventListener('click', handleUrlToVideo);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    const parentGroup = btn.closest('.tabs') || btn.parentElement;
    
    // Switch Active Tab Button
    parentGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Switch Active Content
    // We search for the content in the same container as the tabs if possible, or globally
    const targetContent = $(tabId) || $('tab-' + tabId);
    if (targetContent) {
      const contentParent = targetContent.parentElement;
      contentParent.querySelectorAll(':scope > .tab-content').forEach(c => c.classList.remove('active'));
      targetContent.classList.add('active');
    }
  });
});

// ── Voice Loading ─────────────────────────────────────────────────────────────
async function loadEdgeVoices() {
  try {
    const res = await fetch('/api/voices');
    const data = await res.json();
    const select = document.getElementById('edgeVoiceSelect');
    if (!select || !data.voices) return;
    select.innerHTML = '';
    data.voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voice_id;
      opt.textContent = v.name;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn('Could not load Edge voices:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadEdgeVoices();
});

// ── Speech Rate ───────────────────────────────────────────────────────────────
$('speechRate').addEventListener('input', (e) => {
  speechRate = parseFloat(e.target.value);
  $('rateLabel').textContent = speechRate.toFixed(1) + 'x';
});

// ── Test Voice ────────────────────────────────────────────────────────────────
$('testVoiceFreeBtn').addEventListener('click', async () => {
  await speakText('Xin chào! Đây là giọng đọc mẫu của Google TTS');
});

document.getElementById('testEdgeVoiceBtn')?.addEventListener('click', async () => {
  const voiceId = document.getElementById('edgeVoiceSelect').value;
  const voiceStyle = document.getElementById('edgeVoiceStyle').value;
  const sampleText = 'Xin chào! Đây là giọng đọc Microsoft Edge TTS. Chất lượng rõ ràng và tự nhiên.';
  
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sampleText, voiceId, voiceStyle })
    });
    const data = await res.json();
    if (data.audio) {
      const audio = new Audio(`data:${data.mimeType};base64,${data.audio}`);
      audio.play();
    }
  } catch (e) {
    console.error('Test voice error:', e);
  }
});

// ── Generate Script & Auto-Start ──────────────────────────────────────────────
window.handleGenerate = async () => {
  const basePrompt = $('videoPrompt').value.trim();
  if (!basePrompt) return alert(i18n[currentLang].alert_no_prompt);

  const sceneCount = parseInt(document.getElementById('scene-count-slider').value) || 6;

  let prompt = basePrompt + `\n\nEach scene may contain a "renderMode" field with the values: "default", "glitch", "hand-drawn", "neon", "retro".\n\nChoose renderMode based on scene content:\n- "glitch": technology, hacking, security, AI, error-related scenes\n- "hand-drawn": ideas, creativity, educational explanations, conceptual scenes\n- "neon": opening titles, CTA scenes, major highlights\n- "retro": history, nostalgia, before/after comparisons\n- "default": normal scenes\n\nNot every scene needs a non-default renderMode.\n\nEach scene may contain an "elements" field — an array of up to 3 visual elements.\n\nOnly add elements when the scene contains numbers, statistics, or concrete comparisons.\nDo not add elements to intro scenes or ending scenes.\n\nElement types:\n\n- "stat-counter"\n  Use when there is a single highlighted number (revenue, users, percentages, etc.)\n  Required fields: type, label, value (number), position\n  Optional fields: prefix (default ""), suffix (default "")\n\n- "progress-bar"\n  Use when there is a percentage or completion metric\n  Required fields: type, label, percent (0-100), position\n\n- "chart"\n  Use when multiple data points need comparison (minimum 3 points)\n  Required fields:\n    type,\n    chartType ("bar" or "line"),\n    label,\n    data (array of {label, value}),\n    position\n\n  Maximum 6 data points.\n\nThe "position" field may only use these 3 values — do not use any others:\n\n- "bottom-left"\n  → use for stat-counter or progress-bar\n\n- "bottom-center"\n  → preferred for chart\n\n- "bottom-right"\n  → use for stat-counter or progress-bar\n\nPosition allocation rules by element count:\n\n- 1 element\n  → use "bottom-left"\n\n- 2 elements\n  → use "bottom-left" + "bottom-right"\n\n- 3 elements\n  → use "bottom-left" + "bottom-center" + "bottom-right"\n\nRules when a chart exists:\n\n- If a scene contains a "chart" element, allow a maximum of 2 elements in that scene\n- Charts must always use "bottom-center"\n- The remaining element uses either "bottom-left" or "bottom-right"\n\nDo not invent statistics — only use numbers provided by the user or numbers that reasonably match the content context.`;

  prompt += `\n\nGenerate a video script with EXACTLY ${sceneCount} scenes — no more, no fewer.\n\nDistribute the content evenly and logically across ${sceneCount} scenes.\n\n`;
  if (sceneCount <= 3) {
    prompt += `If ${sceneCount} is small (1–3):\nFocus only on the most essential points.\n\n`;
  } else if (sceneCount >= 15) {
    prompt += `If ${sceneCount} is large (15–30):\nExpand with more detail, examples, and deeper analysis.\n\n`;
  }

  if (currentOrientation === 'portrait') {
    prompt += `\n\nCRITICAL: This is a PORTRAIT (9:16) video for mobile/TikTok/Reels. Keep the "sceneTitle" very short (max 4-5 words) and centered in your logic. Narrative should be punchy. Ensure visual prompts work well for a vertical frame.`;
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

    // Pause and show storyboard instead of auto-starting
    showStoryboard(data.script);

  } catch (e) {
    alert(i18n[currentLang].alert_error + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wand-2"></i> Tạo video ngay';
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
  $('storyboardPanel').style.display = 'none';
  $('storyboardCards').innerHTML = '';
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
function getTTSParams() {
  const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
  
  if (activeTab === 'edge') {
    return {
      voiceId: document.getElementById('edgeVoiceSelect')?.value || 'vi-VN-HoaiMyNeural',
      voiceStyle: document.getElementById('edgeVoiceStyle')?.value || 'default',
    };
  }
  
  // Default: free tab (Google Translate) — no voiceId needed for /api/tts-free
  return { voiceId: null, voiceStyle: 'default' };
}

async function speakText(text) {
  if (activeTab === 'edge') {
    const success = await speakAIVoice(text);
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

function speakAIVoice(text) {
  return new Promise(async (resolve) => {
    try {
      const { voiceId, voiceStyle } = getTTSParams();
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text, voiceId, voiceStyle }),
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
  try {
    if (activeTab === 'edge') {
      const { voiceId, voiceStyle } = getTTSParams();
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text, voiceId, voiceStyle }),
      });
      const data = await r.json();
      if (data.success && !data.useFallback && data.audio) {
        const audioBytes = atob(data.audio);
        if (audioBytes.length > 0) {
          const buf = new Uint8Array(audioBytes.length);
          for (let i = 0; i < audioBytes.length; i++) buf[i] = audioBytes.charCodeAt(i);
          return buf.buffer;
        }
      }
    }

    let r;
    let success = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        r = await fetch('/api/tts-free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (r.ok) {
          success = true;
          break;
        }
        await new Promise(res => setTimeout(res, 1000));
      } catch (e) {
        console.warn(`TTS Retry ${attempt + 1} failed`);
      }
    }

    if (success) {
      const arrayBuf = await r.arrayBuffer();
      return arrayBuf.byteLength > 0 ? arrayBuf : null;
    }
  } catch (err) {
    console.error("getTTSAudioBuffer error:", err);
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
      await yieldControl();
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

  setProgress(5, "Đang tải tài nguyên hình ảnh...");
  renderer.setArticleMedia(currentScript._articleMedia);
  await preloadSceneImages(scenes);

  renderer.setScenes(scenes);

  for (let i = 0; i < scenes.length; i++) {
    if (!isRunning) break;
    const scene = scenes[i];
    setProgress((i / scenes.length) * 100, `Đang xử lý cảnh ${i + 1}...`);

    if (scene.videoScene) {
      setProgress((i / scenes.length) * 100, `Đang chuẩn bị video cho cảnh ${i + 1}...`);
      await renderer.prepareVideoScene(scene);
    }

    await new Promise(res => {
      renderer.onSceneTitleShown = res;
      renderer.renderScene(i);
    });

    await new Promise(res => setTimeout(res, 300));
    if (!isRunning) break;

    // Skip TTS for video scenes (YouTube or MP4)
    if (!scene.videoScene) {
      await speakText(scene.narration);
    }
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

  setProgress(5, "Đang tải tài nguyên hình ảnh...");
  renderer.setArticleMedia(currentScript._articleMedia);
  await preloadSceneImages(scenes);

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
    setProgress((i / scenes.length) * 20, `Đang tải âm thanh cảnh ${i + 1}...`);

    let audioBuf = null;
    if (scenes[i].videoScene) {
      // Silence/Video audio only, no TTS for video scenes
      audioBuf = null;
    } else if (scenes[i].narration && scenes[i].narration.trim()) {
      const arrayBuf = await getTTSAudioBuffer(scenes[i].narration);
      if (arrayBuf && arrayBuf.byteLength > 0) {
        try {
          audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        } catch (decodeErr) {
          console.error(`Audio decoding failed for scene ${i + 1}:`, decodeErr);
          // Only show alert once to not annoy user if many scenes fail
          if (i === 0) {
            alert("Không thể giải mã âm thanh TTS (có thể Google đã chặn yêu cầu). Hãy thử dùng tab 'Edge' để có giọng đọc ổn định hơn.");
          }
          audioBuf = null; 
        }
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
  
  if (scenes[0].videoScene) {
    await renderer.prepareVideoScene(scenes[0]);
  }
  
  renderer.renderScene(0, 0);

  try {
    for (let f = 0; f < totalFrames; f++) {
      if (!isRunning) break;
      const currentTime = f / fps; // seconds
      const currentMs = currentTime * 1000;
      let timing = sceneTimings[currentSceneIdx];

      // Scene Transition
      if (currentTime >= timing.sceneEnd && currentSceneIdx < scenes.length - 1) {
        currentSceneIdx++;
        timing = sceneTimings[currentSceneIdx];
        
        if (scenes[currentSceneIdx].videoScene) {
           await renderer.prepareVideoScene(scenes[currentSceneIdx]);
        }
        
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
      renderer.updateParticles(1 / fps);
      renderer._drawScene(scenes[currentSceneIdx], 1 / fps, currentMs);

      // Encode
      await exportEngine.encodeVideoFrame(f);
      if (exportEngine.hasError) {
        throw new Error("Lỗi mã hóa video (GPU/Codec). Vui lòng thử lại hoặc giảm số lượng cảnh.");
      }

      // Async Yield for UI update every 10 frames
      if (f % 10 === 0) {
        const pct = 25 + (f / totalFrames) * 70;
        setProgress(pct, `Đang Render Frame (${f}/${totalFrames}) - Đảm bảo mượt mà 60 FPS`);
        await yieldControl();
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
      setButtonState('done');

      // Initialize YouTube upload section
      checkYouTubeStatus();
      // Pre-fill title from script
      if ($('ytVideoTitle') && currentScript?.videoTitle) {
        $('ytVideoTitle').value = currentScript.videoTitle;
      }
      // Show Shorts badge if portrait
      const shortsBadge = $('ytShortsBadge');
      if (shortsBadge) {
        shortsBadge.style.display = currentOrientation === 'portrait' ? 'block' : 'none';
      }
    }
  } catch (err) {
    console.error("Export Error:", err);
    alert(err.message || i18n[currentLang].alert_gen_error);
    setButtonState('ready');
  } finally {
    isRunning = false;
    progressSection.style.display = 'none';
    renderer.offlineMode = false;
    renderer.stop();
    window.activeAudio = null;
    if (window.lucide) lucide.createIcons();
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
  loadEdgeVoices();
  lucide.createIcons();
})();


// ── Storyboard Action Listeners ─────────────────────────────────────────────

// Storyboard: Render button
document.getElementById('storyboardRenderBtn')?.addEventListener('click', () => {
  if (!currentScript) return;
  canvasOverlay.classList.add('hidden');
  $('storyboardPanel').style.display = 'none';
  startCreation(true); // Full offline export
});

// Storyboard: Preview button (realtime, no recording)
document.getElementById('storyboardPreviewBtn')?.addEventListener('click', () => {
  if (!currentScript) return;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  canvasOverlay.classList.add('hidden');
  isPreviewMode = true;
  startCreation(false); // Preview only
});

// Storyboard: Collapse toggle
document.getElementById('storyboardCollapseBtn')?.addEventListener('click', () => {
  const cards = $('storyboardCards');
  const footer = document.querySelector('.storyboard-footer');
  const icon = document.querySelector('#storyboardCollapseBtn i');
  const isCollapsed = cards.style.display === 'none';

  cards.style.display = isCollapsed ? '' : 'none';
  if (footer) footer.style.display = isCollapsed ? '' : 'none';
  if (icon) icon.setAttribute('data-lucide', isCollapsed ? 'chevron-up' : 'chevron-down');
  if (window.lucide) lucide.createIcons();
});

// Storyboard: Apply voice to all (UI only, logic could be added to update all scenes if needed)
document.getElementById('storyboardEditAllBtn')?.addEventListener('click', () => {
  alert(i18n[currentLang].alert_voice_applied);
});

// ── YouTube Integration ───────────────────────────────────────────────────────

async function checkYouTubeStatus() {
  try {
    const res = await fetch('/api/youtube/status');
    const data = await res.json();
    ytAuthenticated = data.authenticated;

    if (data.authenticated) {
      $('ytNotConnected').style.display = 'none';
      $('ytConnected').style.display = 'block';
      $('ytUploadSuccess').style.display = 'none';
      const nameEl = $('ytChannelName');
      if (nameEl) nameEl.textContent = data.channelName || 'Kênh YouTube';
    } else {
      $('ytNotConnected').style.display = 'block';
      $('ytConnected').style.display = 'none';
    }

    // Show Shorts badge if portrait
    const shortsBadge = $('ytShortsBadge');
    if (shortsBadge) {
      shortsBadge.style.display = currentOrientation === 'portrait' ? 'block' : 'none';
    }
  } catch (e) {
    console.warn('[YouTube] Status check failed:', e);
  }
}

// Connect button — open OAuth popup
$('btnYoutubeConnect')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/youtube/auth-url');
    const { url } = await res.json();

    const popup = window.open(url, 'youtube-oauth', 'width=500,height=650,scrollbars=yes');

    // Listen for popup message
    const handler = async (event) => {
      if (event.data?.type === 'yt-auth-success') {
        window.removeEventListener('message', handler);
        popup?.close();
        await checkYouTubeStatus();
      } else if (event.data?.type === 'yt-auth-error') {
        window.removeEventListener('message', handler);
        popup?.close();
        alert(`${i18n[currentLang].alert_yt_connect_failed}${event.data.error}`);
      }
    };
    window.addEventListener('message', handler);
  } catch (e) {
    alert(i18n[currentLang].alert_yt_auth_error + e.message);
  }
});

// Disconnect button
$('btnYoutubeDisconnect')?.addEventListener('click', async () => {
  await fetch('/api/youtube/logout');
  ytAuthenticated = false;
  $('ytNotConnected').style.display = 'block';
  $('ytConnected').style.display = 'none';
  $('ytUploadSuccess').style.display = 'none';
});

// Upload button
$('btnYoutubeUpload')?.addEventListener('click', async () => {
  if (!videoBlob) {
    alert(i18n[currentLang].alert_no_video);
    return;
  }

  const btn = $('btnYoutubeUpload');
  const progress = $('ytUploadProgress');
  const bar = $('ytUploadBar');
  const label = $('ytUploadLabel');
  const pct = $('ytUploadPct');

  // Get form values
  const rawTitle = $('ytVideoTitle')?.value.trim()
    || currentScript?.videoTitle
    || 'AI Video';
  const desc = $('ytVideoDesc')?.value.trim() || 'Tạo bởi MinusAI';
  const tags = $('ytVideoTags')?.value.trim() || 'AI,MinusAI';

  // Disable button, show progress
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang tải lên...';
  progress.style.display = 'block';
  label.textContent = 'Đang gửi video lên server...';
  bar.style.width = '5%';
  pct.textContent = '5%';

  try {
    // Build query params
    const params = new URLSearchParams({
      title: rawTitle,
      description: desc,
      orientation: currentOrientation,
      tags: tags
    });

    // Simulate progress while uploading (real progress comes from server logs)
    let fakeProgress = 5;
    const progressInterval = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 3, 90);
      bar.style.width = fakeProgress + '%';
      pct.textContent = Math.round(fakeProgress) + '%';
      label.textContent = fakeProgress < 50
        ? 'Đang truyền video...'
        : 'YouTube đang xử lý...';
    }, 800);

    const res = await fetch(`/api/youtube/upload?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/webm' },
      body: videoBlob,
    });

    clearInterval(progressInterval);

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Upload thất bại');
    }

    // Success
    bar.style.width = '100%';
    pct.textContent = '100%';
    label.textContent = 'Hoàn tất!';

    await new Promise(r => setTimeout(r, 500));

    progress.style.display = 'none';
    $('ytConnected').style.display = 'none';
    $('ytUploadSuccess').style.display = 'block';

    const videoLink = $('ytVideoLink');
    if (videoLink) {
      videoLink.href = data.videoUrl;
    }

    const shortsLink = $('ytShortsLink');
    if (shortsLink && data.shortsUrl) {
      shortsLink.href = data.shortsUrl;
      shortsLink.style.display = 'inline-flex';
    }

  } catch (e) {
    if (typeof progressInterval !== 'undefined') clearInterval(progressInterval);
    progress.style.display = 'none';
    alert(i18n[currentLang].alert_yt_upload_error + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="upload-cloud"></i> Đăng lên YouTube';
    if (window.lucide) lucide.createIcons();
  }
});
