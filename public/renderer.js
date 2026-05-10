/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  AI VIDEO RENDERER — Canvas-based cinematic video engine               ║
 * ║  Handles: animation, transitions, particle FX, typography               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class VideoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // State
    this.scenes = [];
    this.currentSceneIdx = -1;
    this.animFrame = null;
    this.sceneStartTime = 0;
    this.globalTime = 0;
    this.phase = 'idle'; // idle | entering | displaying | exiting
    this.phaseTime = 0;

    // Particle system
    this.particles = [];
    this.initParticles();

    // Transition state
    this.transitionAlpha = 0;
    this.transitionDir = 1; // 1=fade in, -1=fade out
    this.nextSceneData = null;

    // Callbacks
    this.onSceneComplete = null;
    this.onSceneTitleShown = null;

    // Draw idle screen
    this.drawIdleScreen();
  }

  // ── Background Themes ─────────────────────────────────────────────────────
  THEMES = {
    tech: [
      { pos: 0,   color: '#0a0e1a' },
      { pos: 0.5, color: '#0f1a2e' },
      { pos: 1,   color: '#071320' },
    ],
    space: [
      { pos: 0,   color: '#05050f' },
      { pos: 0.5, color: '#0c0820' },
      { pos: 1,   color: '#07051a' },
    ],
    abstract: [
      { pos: 0,   color: '#10051f' },
      { pos: 0.5, color: '#1a0a2e' },
      { pos: 1,   color: '#0f0518' },
    ],
    nature: [
      { pos: 0,   color: '#050f0a' },
      { pos: 0.5, color: '#081a12' },
      { pos: 1,   color: '#040e08' },
    ],
    corporate: [
      { pos: 0,   color: '#0a0a14' },
      { pos: 0.5, color: '#12121e' },
      { pos: 1,   color: '#0a0a14' },
    ],
    minimal: [
      { pos: 0,   color: '#111115' },
      { pos: 0.5, color: '#18181e' },
      { pos: 1,   color: '#111115' },
    ],
  };

  ANIM_STYLES = ['slide-up', 'slide-left', 'zoom-in', 'fade-in', 'typewriter'];

  // ── Particle System ───────────────────────────────────────────────────────
  initParticles() {
    this.particles = [];
    const count = Math.round(80 * (this.W * this.H) / (1280 * 720));
    const finalCount = Math.max(40, Math.min(150, count));
    
    for (let i = 0; i < finalCount; i++) {
      this.particles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        r: Math.random() * 1.8 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.4 + 0.05,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.pulse += dt * 1.5;
      if (p.x < 0) p.x = this.W;
      if (p.x > this.W) p.x = 0;
      if (p.y < 0) p.y = this.H;
      if (p.y > this.H) p.y = 0;
    }
  }

  drawParticles(accentColor) {
    const ctx = this.ctx;
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Background ────────────────────────────────────────────────────────────
  drawBackground(theme, accentColor, t) {
    const ctx = this.ctx;
    const stops = this.THEMES[theme] || this.THEMES.minimal;
    const rX = (px) => px / 1280 * this.W;
    const rY = (px) => px / 720  * this.H;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);

    // Animated radial gradient center
    const cx = this.W * 0.5 + Math.sin(t * 0.3) * rX(80);
    const cy = this.H * 0.5 + Math.cos(t * 0.2) * rY(40);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.H * 0.9);
    for (const s of stops) {
      grad.addColorStop(s.pos, s.color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Subtle accent radial bloom
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, rMin(420));
    bloom.addColorStop(0, accentColor + '18');
    bloom.addColorStop(1, 'transparent');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grid lines (subtle)
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    const gridSpacing = rMin(80);
    for (let x = 0; x < this.W; x += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y < this.H; y += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    ctx.restore();

    // Vignette
    const vig = ctx.createRadialGradient(this.W/2, this.H/2, 0, this.W/2, this.H/2, this.W * 0.8);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  // ── Image Rendering ───────────────────────────────────────────────────────
  /**
   * Draws an image to fill the canvas using "cover" logic (no distortion).
   */
  drawImageCover(img) {
    const ctx = this.ctx;
    const canvasRatio = this.W / this.H;
    const imgRatio = img.width / img.height;

    let drawW, drawH, offsetX, offsetY;

    if (imgRatio > canvasRatio) {
      drawH = this.H;
      drawW = img.width * (this.H / img.height);
      offsetX = (this.W - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = this.W;
      drawH = img.height * (this.W / img.width);
      offsetX = 0;
      offsetY = (this.H - drawH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }

  // ── Decorative Elements ───────────────────────────────────────────────────
  drawDecorativeLines(accentColor, alpha, t) {
    const ctx = this.ctx;
    const rX = (px) => px / 1280 * this.W;
    const rY = (px) => px / 720  * this.H;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);

    ctx.save();

    // Center horizontal accent line
    const lineY = this.H * 0.5 + rY(60);
    const lineW = rX(280) * alpha;
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;

    // Left line
    ctx.beginPath();
    ctx.moveTo(this.W/2 - lineW - rX(20), lineY);
    ctx.lineTo(this.W/2 - rX(20), lineY);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(this.W/2 + rX(20), lineY);
    ctx.lineTo(this.W/2 + lineW + rX(20), lineY);
    ctx.stroke();

    // Center dot
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.W/2, lineY, 3, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    // Corner accents
    const cSize = rMin(30) * alpha;
    const paddingX = rX(40);
    const paddingY = rY(40);
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.4;
    // top-left
    ctx.beginPath(); ctx.moveTo(paddingX, paddingY + cSize); ctx.lineTo(paddingX, paddingY); ctx.lineTo(paddingX + cSize, paddingY); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(this.W-paddingX-cSize, paddingY); ctx.lineTo(this.W-paddingX, paddingY); ctx.lineTo(this.W-paddingX, paddingY+cSize); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(paddingX, this.H-paddingY-cSize); ctx.lineTo(paddingX, this.H-paddingY); ctx.lineTo(paddingX+cSize, this.H-paddingY); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(this.W-paddingX-cSize, this.H-paddingY); ctx.lineTo(this.W-paddingX, this.H-paddingY); ctx.lineTo(this.W-paddingX, this.H-paddingY-cSize); ctx.stroke();

    ctx.restore();
  }

  // ── Text Rendering ────────────────────────────────────────────────────────
  drawTitle(text, animStyle, progress, accentColor, renderMode = 'default', timestamp = 0) {
    const ctx = this.ctx;
    const rX = (px) => px / 1280 * this.W;
    const rY = (px) => px / 720  * this.H;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);
    
    // Anchor to Top-Left
    const originX = rX(60);
    const originY = rY(80);

    let x = originX, y = originY;
    let alpha = 1, scale = 1, blur = 0;
    let charProgress = 1;

    const ease = this.easeOutQuart(Math.min(progress * 1.5, 1));

    switch (animStyle) {
      case 'slide-up':
        y = originY + (1 - ease) * rY(40);
        alpha = ease;
        break;
      case 'slide-left':
        x = originX + (1 - ease) * rX(60);
        alpha = ease;
        break;
      case 'zoom-in':
        scale = 0.8 + ease * 0.2;
        alpha = ease;
        break;
      case 'fade-in':
        alpha = ease;
        blur = (1 - ease) * rMin(6);
        break;
      case 'typewriter':
        charProgress = Math.min(progress * 3, 1);
        alpha = 1;
        break;
      default:
        alpha = ease;
        y = originY + (1 - ease) * rY(30);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (blur > 0) ctx.filter = `blur(${blur}px)`;

    // Glow shadow
    if (renderMode !== 'hand-drawn') {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = rMin(20);
      if (renderMode === 'neon') {
        ctx.shadowBlur = rMin(25) + Math.sin(timestamp / 400) * rMin(8);
      }
    }

    let displayText = text;
    if (animStyle === 'typewriter' && charProgress < 1) {
      displayText = text.slice(0, Math.floor(charProgress * text.length));
    }

    // Title font
    const fontSize = this.calcFontSize(text, Math.round(rMin(56)), this.W - rX(160));
    if (renderMode === 'hand-drawn') {
      ctx.font = `800 ${fontSize}px 'Comic Sans MS', cursive`;
    } else {
      ctx.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const textGrad = ctx.createLinearGradient(0, 0, rX(300), 0);
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(1, accentColor);
    ctx.fillStyle = textGrad;
    ctx.fillText(displayText, 0, 0);

    // Cursor
    if (animStyle === 'typewriter' && charProgress < 1) {
      const tw = ctx.measureText(displayText).width;
      ctx.fillStyle = accentColor;
      ctx.fillRect(tw + rX(4), 0, rX(3), fontSize);
    }

    ctx.restore();
  }

  drawTextContent(text, animStyle, progress, accentColor, renderMode, timestamp) {
    if (!text) return;
    const ctx = this.ctx;
    const rX = (px) => px / 1280 * this.W;
    const rY = (px) => px / 720  * this.H;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);
    
    // Slight delay and smoother entry than title
    const ease = this.easeOutQuart(Math.min(progress * 1.2, 1));
    const alpha = ease;
    const yOffset = (1 - ease) * rY(20);
    
    const x = rX(60);
    const y = rY(160) + yOffset; 
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    const fontSize = Math.max(Math.round(rMin(24)), 14);
    ctx.font = `400 ${fontSize}px 'Inter', system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Wrap and draw
    this.wrapText(ctx, text, x, y, this.W - rX(120), fontSize * 1.5);
    
    ctx.restore();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return 0;
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    let linesCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        linesCount++;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    linesCount++;
    return linesCount * lineHeight;
  }

  calcFontSize(text, maxSize, maxWidth) {
    let size = maxSize;
    const ctx = this.ctx;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);
    const minSize = Math.max(Math.round(rMin(32)), 16);

    while (size > minSize) {
      ctx.font = `800 ${size}px 'Space Grotesk', system-ui, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 4;
    }
    return size;
  }

  drawSceneNumber(idx, total, accentColor, alpha) {
    const ctx = this.ctx;
    const rX = (px) => px / 1280 * this.W;
    const rY = (px) => px / 720  * this.H;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = `600 ${Math.max(Math.round(rMin(14)), 10)}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = rMin(8);
    ctx.fillText(`${idx + 1} / ${total}`, this.W - rX(40), rY(40));
    ctx.restore();
  }

  drawProgressBar(progress, accentColor) {
    const ctx = this.ctx;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);
    const barH = rMin(3);
    const barY = this.H - barH;

    ctx.save();
    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, barY, this.W, barH);

    // Fill
    const fillW = this.W * progress;
    const fillGrad = ctx.createLinearGradient(0, 0, fillW, 0);
    fillGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    fillGrad.addColorStop(1, accentColor);
    ctx.fillStyle = fillGrad;
    ctx.fillRect(0, barY, fillW, barH);

    // Glow dot at end
    if (fillW > 4) {
      ctx.beginPath();
      ctx.arc(fillW, barY + barH/2, rMin(4), 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = rMin(10);
      ctx.fill();
    }
    ctx.restore();
  }

  drawVideoTitle(title, alpha) {
    if (!title) return;
    const ctx = this.ctx;
    const rX = (px) => px / 1280 * this.W;
    const rY = (px) => px / 720  * this.H;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);

    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.font = `500 ${Math.max(Math.round(rMin(15)), 10)}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, rX(40), rY(36));
    ctx.restore();
  }

  // ── Easing Functions ──────────────────────────────────────────────────────
  easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  easeInQuad(t) { return t * t; }
  easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
  easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // ── Idle Screen ───────────────────────────────────────────────────────────
  drawIdleScreen() {
    const ctx = this.ctx;
    const rMin = (px) => px / 720 * Math.min(this.W, this.H);
    ctx.clearRect(0, 0, this.W, this.H);

    // Background
    const grad = ctx.createRadialGradient(this.W/2, this.H/2, 0, this.W/2, this.H/2, this.H * 0.8);
    grad.addColorStop(0, '#15161c');
    grad.addColorStop(1, '#0a0a0e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grid
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#747689';
    ctx.lineWidth = 1;
    const gridSpacing = rMin(80);
    for (let x = 0; x < this.W; x += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y < this.H; y += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    ctx.restore();

    // Center logo area
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(this.W/2, this.H/2, rMin(120), 0, Math.PI * 2);
    ctx.strokeStyle = '#747689';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.W/2, this.H/2, rMin(80), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.font = `700 ${Math.round(rMin(26))}px Space Grotesk, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillText('VideoTool', this.W/2, this.H/2);
  }

  // ── Transition Flash ──────────────────────────────────────────────────────
  drawTransitionOverlay(alpha, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  // ── Main Render Loop ──────────────────────────────────────────────────────
  setScenes(scenes) {
    this.scenes = scenes;
    this.currentSceneIdx = -1;
    this.globalTime = 0;
    this.offlineMode = false;
    this.initParticles(); // Re-initialize particles for new session
  }

  // Start rendering a specific scene
  renderScene(idx, now = performance.now()) {
    const scene = this.scenes[idx];
    if (!scene) return;

    this.currentSceneIdx = idx;
    this.phase = 'entering';
    this.phaseStartTime = now;

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (!this.offlineMode) {
      this._renderLoop(scene, now);
    }
  }

  _renderLoop(scene, lastTime) {
    const now = performance.now();
    // Cap dt at 0.1 for physics/particles only to prevent them jumping through walls
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    
    // globalTime should use absolute wall-clock time so backgrounds never lag
    this.globalTime = now / 1000;
    
    // phaseTime is absolute time since current phase started
    this.phaseTime = (now - this.phaseStartTime) / 1000;

    // Update particles
    this.updateParticles(dt);

    this._drawScene(scene, dt, now);

    this.animFrame = requestAnimationFrame(() => this._renderLoop(scene, now));
  }

  _drawScene(scene, dt, now) {
    const ctx = this.ctx;
    const theme = scene.backgroundTheme || 'tech';
    const accent = scene.accentColor || '#747689';
    const animStyle = scene.animationStyle || 'slide-up';
    const renderMode = scene.renderMode || 'default';
    const totalScenes = this.scenes.length;
    const globalProgress = (this.currentSceneIdx + Math.min(this.phaseTime / 12, 1)) / totalScenes;

    // ENTERING phase: 0.8s
    const ENTER_DURATION = 0.8;
    // EXITING phase: 0.6s (called externally via exitScene)
    // DISPLAYING: infinite until exitScene called

    let enterProgress = 1;
    let exitProgress = 0;
    let overlayAlpha = 0;

    if (this.phase === 'entering') {
      enterProgress = Math.min(this.phaseTime / ENTER_DURATION, 1);
      overlayAlpha = 1 - enterProgress;
      if (enterProgress >= 1) {
        this.phase = 'displaying';
        this.phaseStartTime = now;
        this.phaseTime = 0;
        
        if (this.onSceneTitleShown) {
          this.onSceneTitleShown(this.currentSceneIdx);
          this.onSceneTitleShown = null;
        }
      }
    } else if (this.phase === 'exiting') {
      const EXIT_DURATION = 0.5;
      exitProgress = Math.min(this.phaseTime / EXIT_DURATION, 1);
      overlayAlpha = this.easeInQuad(exitProgress);
      if (exitProgress >= 1) {
        this.phase = 'done';
        if (this.onSceneComplete) this.onSceneComplete(this.currentSceneIdx);
        return;
      }
    }

    if (renderMode === 'retro') {
      ctx.save();
      ctx.filter = 'saturate(0.75) contrast(1.1)';
    }

    // Draw
    if (scene.loadedImage) {
      this.drawImageCover(scene.loadedImage);
      
      // Critical: Dark gradient overlay for typography readability
      const grad = ctx.createLinearGradient(0, 0, 0, this.H);
      grad.addColorStop(0, 'rgba(0,0,0,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.W, this.H);
    } else {
      this.drawBackground(theme, accent, this.globalTime);
    }
    this.drawParticles(accent);
    this.drawDecorativeLines(accent, Math.min(enterProgress * 1.5, 1) * (1 - exitProgress * 2), this.globalTime);
    this.drawTitle(scene.sceneTitle, animStyle, enterProgress * (1 - exitProgress), accent, renderMode, now);
    this.drawTextContent(scene.textContent, animStyle, enterProgress * (1 - exitProgress), accent, renderMode, now);
    
    if (scene.elements && scene.elements.length > 0) {
      let sceneProgress = 0;
      
      if (this.phase === 'entering') {
        sceneProgress = 0;
      } else if (this.phase === 'exiting' || this.phase === 'done') {
        sceneProgress = 1;
      } else {
        // Displaying phase: Synchronize strictly with audio time (Single Source of Truth)
        if (window.activeAudio && window.activeAudio.duration > 0) {
          sceneProgress = window.activeAudio.currentTime / window.activeAudio.duration;
        } else {
          // Fallback if no audio
          const duration = scene.estimatedDuration || 5;
          sceneProgress = Math.min(this.phaseTime / duration, 1);
        }
      }
      
      scene.elements.forEach(element => {
        const position = VisualElementRenderer.resolvePosition(
          element.position,
          this.W,
          this.H,
          element.type
        );
        VisualElementRenderer.draw(ctx, element, sceneProgress, accent, position);
      });
    }

    this.drawSceneNumber(this.currentSceneIdx, totalScenes, accent, Math.min(enterProgress * 2, 1));
    this.drawVideoTitle(this.scenes[0]?.videoTitle || '', Math.min(enterProgress * 2, 1));
    this.drawProgressBar(globalProgress, accent);

    // Overlay for transition
    if (overlayAlpha > 0) {
      this.drawTransitionOverlay(overlayAlpha, theme === 'minimal' ? '#111115' : '#05060e');
    }

    if (renderMode === 'retro') {
      ctx.restore();
    }

    this.applyRenderMode(renderMode, now);
  }

  applyRenderMode(mode, timestamp) {
    if (mode === 'default') return;
    const ctx = this.ctx;
    const scene = this.scenes[this.currentSceneIdx];
    if (!scene) return;
    const accentColor = scene.accentColor || '#747689';
    const theme = scene.backgroundTheme || 'tech';
    
    if (mode === 'glitch') {
      if (!this.glitchFramesCounter) this.glitchFramesCounter = 0;
      if (!this.glitchBurstCounter) this.glitchBurstCounter = 0;

      this.glitchFramesCounter++;
      
      if (this.glitchBurstCounter > 0) {
        this.glitchBurstCounter--;
        const numStrips = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numStrips; i++) {
           const h = 4 + Math.random() * 16;
           const y = Math.random() * (this.H - h);
           const offset = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 25);
           const strip = ctx.getImageData(0, y, this.W, h);
           ctx.putImageData(strip, offset, y);
        }
        
        const canvasData = ctx.getImageData(0, 0, this.W, this.H);
        const pixels = canvasData.data;
        const newImageData = ctx.createImageData(this.W, this.H);
        const newPixels = newImageData.data;
        
        for (let y = 0; y < this.H; y++) {
          for (let x = 0; x < this.W; x++) {
             const idx = (y * this.W + x) * 4;
             const rX = x + 3;
             if (rX < this.W) newPixels[idx] = pixels[(y * this.W + rX) * 4];
             newPixels[idx+1] = pixels[idx+1];
             const bX = x - 3;
             if (bX >= 0) newPixels[idx+2] = pixels[(y * this.W + bX) * 4 + 2];
             newPixels[idx+3] = pixels[idx+3];
          }
        }
        
        if (!this.glitchOffscreenCanvas) {
          this.glitchOffscreenCanvas = document.createElement('canvas');
          this.glitchOffscreenCanvas.width = this.W;
          this.glitchOffscreenCanvas.height = this.H;
          this.glitchOffscreenCtx = this.glitchOffscreenCanvas.getContext('2d');
        }
        this.glitchOffscreenCtx.putImageData(newImageData, 0, 0);
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.3;
        ctx.drawImage(this.glitchOffscreenCanvas, 0, 0);
        ctx.restore();
        
      } else {
        if (Math.random() < 0.05 && this.glitchFramesCounter > 8) {
           this.glitchBurstCounter = 2 + Math.floor(Math.random() * 3);
           this.glitchFramesCounter = 0;
        }
      }
    } else if (mode === 'hand-drawn') {
      ctx.save();
      const isDark = ['tech', 'space', 'abstract', 'corporate', 'minimal'].includes(theme);
      ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
      ctx.globalAlpha = 0.03 + Math.random() * 0.03;
      ctx.lineWidth = 1;
      const numLines = 80 + Math.floor(Math.random() * 40);
      ctx.beginPath();
      for (let i = 0; i < numLines; i++) {
        const x = Math.random() * this.W;
        const y = Math.random() * this.H;
        const len = 10 + Math.random() * 20;
        const angle = Math.random() * Math.PI * 2;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      }
      ctx.stroke();
      ctx.restore();
    } else if (mode === 'neon') {
      ctx.save();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 20;
      ctx.strokeRect(2, 2, this.W - 4, this.H - 4);
      ctx.restore();
    } else if (mode === 'retro') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 0; y < this.H; y += 4) {
        ctx.fillRect(0, y, this.W, 2);
      }
      const vig = ctx.createRadialGradient(this.W/2, this.H/2, this.H/4, this.W/2, this.H/2, this.W/1.5);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, this.W, this.H);
      
      ctx.fillStyle = '#ffffff';
      const numGrain = 200 + Math.floor(Math.random() * 100);
      for (let i = 0; i < numGrain; i++) {
         ctx.globalAlpha = 0.05 + Math.random() * 0.05;
         ctx.fillRect(Math.random() * this.W, Math.random() * this.H, 2, 2);
      }
      ctx.restore();
    }
  }

  // Called when speech ends — start exit animation
  exitScene(now = performance.now()) {
    if (this.phase === 'displaying' || this.phase === 'entering') {
      this.phase = 'exiting';
      this.phaseStartTime = now;
      this.phaseTime = 0;
    }
  }

  // Stop rendering
  stop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.phase = 'idle';
    this.particles = []; // Release particle objects to GC
  }

  // Draw completion frame (Ends abruptly as requested)
  drawCompletionFrame() {
    this.stop();
  }
}

// Export
window.VideoRenderer = VideoRenderer;

class VisualElementRenderer {
  static resolvePosition(positionString, canvasWidth, canvasHeight, elementType = 'default') {
    const rX = (px) => Math.round(px / 1280 * canvasWidth);
    const rY = (px) => Math.round(px / 720  * canvasHeight);

    const chartRightX    = canvasWidth  - rX(370);
    const chartCenterX   = (canvasWidth - rX(320)) / 2;
    const Y_BOTTOM_CHART   = canvasHeight - rY(210);
    const Y_BOTTOM_DEFAULT = canvasHeight - rY(200);
    const yBottom = elementType === 'chart' ? Y_BOTTOM_CHART : Y_BOTTOM_DEFAULT;

    switch (positionString) {
      case 'bottom-left':   return { x: rX(40),  y: yBottom };
      case 'bottom-center': return { x: chartCenterX, y: yBottom };
      case 'bottom-right':  return { x: elementType === 'chart' ? chartRightX : canvasWidth - rX(360), y: yBottom };
      case 'center-left':   return { x: rX(40),  y: yBottom };
      case 'center-right':  return { x: elementType === 'chart' ? chartRightX : canvasWidth - rX(360), y: yBottom };
      default:              return { x: rX(40),  y: yBottom };
    }
  }

  static draw(ctx, element, sceneProgress, accentColor, position) {
    const canvasHeight = ctx.canvas.height;
    const canvasWidth = ctx.canvas.width;
    const rX = (px) => Math.round(px / 1280 * canvasWidth);
    const rY = (px) => Math.round(px / 720 * canvasHeight);
    const rMin = (px) => px / 720 * Math.min(canvasWidth, canvasHeight);
    const rFontY = (px) => Math.max(Math.round(px / 720 * canvasHeight), 9);

    const MIN_SAFE_Y = canvasHeight - rY(220);

    if (position.y < MIN_SAFE_Y) {
      position.y = MIN_SAFE_Y;
    }

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const alpha = Math.min(1, sceneProgress * 4);
    if (alpha <= 0) return;

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.globalAlpha = alpha;

    if (element.type === 'stat-counter') {
      const cardW = rX(260);
      const cardH = rY(120);
      const borderRadius = rFontY(12);

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(0, 0, cardW, cardH, borderRadius);
      ctx.fill();

      // Left border
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(0, 0, rX(4), cardH, { tl: borderRadius, bl: borderRadius, tr: 0, br: 0 });
      ctx.fill();

      // Top label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `${rFontY(14)}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText((element.label || '').toUpperCase(), rX(20), rY(20));

      // Animated number
      const targetVal = element.value || 0;
      const currentVal = Math.floor(targetVal * easeOutCubic(sceneProgress));
      const prefix = element.prefix || '';
      const suffix = element.suffix || '';
      const formatted = currentVal.toLocaleString('en-US');

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${rFontY(42)}px Inter, sans-serif`;
      ctx.fillText(`${prefix}${formatted}${suffix}`, rX(20), rY(50));

    } else if (element.type === 'progress-bar') {
      const trackW = rX(280);
      const trackH = rY(10);
      const trackY = rY(30);

      // Top label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `${rFontY(13)}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText((element.label || '').toUpperCase(), 0, 0);

      // Track background
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(0, trackY, trackW, trackH, rY(5));
      ctx.fill();

      // Fill bar
      const targetPct = Math.min(Math.max(element.percent || 0, 0), 100);
      const currentPct = targetPct * easeOutCubic(sceneProgress);
      const fillWidth = trackW * (currentPct / 100);

      if (fillWidth > 0) {
        const grad = ctx.createLinearGradient(0, 0, fillWidth, 0);
        grad.addColorStop(0, accentColor);
        grad.addColorStop(1, accentColor + '40');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(0, trackY, fillWidth, trackH, rY(5));
        ctx.fill();

        // Moving dot
        ctx.fillStyle = accentColor;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = rFontY(10);
        ctx.beginPath();
        ctx.arc(fillWidth, trackY + trackH/2, rFontY(6), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      // Percentage text
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${rFontY(16)}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.floor(currentPct)}%`, trackW + rX(10), trackY + trackH/2);

    } else if (element.type === 'chart') {
      const data = element.data || [];
      const dataCount = data.length;
      const chartWidth = rX(320);
      const chartHeight = rY(180);
      const bottomY = chartHeight - rY(20);
      const xAxisY = rY(30);

      // Title
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `${rFontY(13)}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText((element.label || ''), 0, 0);

      // Axes
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, xAxisY);
      ctx.lineTo(0, bottomY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(0, bottomY);
      ctx.lineTo(chartWidth, bottomY);
      ctx.stroke();

      if (dataCount > 0) {
        const maxValue = Math.max(...data.map(d => d.value || 0), 1);
        const maxBarHeight = chartHeight - rY(60);
        const gap = rX(10);
        const totalGap = gap * (dataCount + 1);
        const barWidth = Math.max(rX(2), (chartWidth - totalGap) / dataCount);

        if (element.chartType === 'line') {
           const points = [];
           for (let i = 0; i < dataCount; i++) {
             const val = data[i].value || 0;
             const x = gap + i * (barWidth + gap) + barWidth / 2;
             const targetY = bottomY - (maxBarHeight * (val / maxValue));
             points.push({ x, y: targetY });

             ctx.fillStyle = '#ffffff';
             ctx.font = `${rFontY(12)}px Inter, sans-serif`;
             ctx.textAlign = 'center';
             ctx.fillText(data[i].label || '', x, bottomY + rY(10));
           }
           
           const drawProgressX = chartWidth * easeOutCubic(sceneProgress);

           ctx.save();
           ctx.beginPath();
           ctx.rect(0, 0, drawProgressX, chartHeight);
           ctx.clip();

           ctx.beginPath();
           ctx.moveTo(points[0].x, points[0].y);
           for (let i = 1; i < dataCount; i++) ctx.lineTo(points[i].x, points[i].y);
           ctx.strokeStyle = accentColor;
           ctx.lineWidth = 2;
           ctx.stroke();

           ctx.fillStyle = accentColor;
           for (let i = 0; i < dataCount; i++) {
             ctx.beginPath();
             ctx.arc(points[i].x, points[i].y, rMin(4), 0, Math.PI * 2);
             ctx.fill();
           }

           ctx.restore();

         } else {
           for (let i = 0; i < dataCount; i++) {
             const val = data[i].value || 0;
             const currentVal = val * easeOutCubic(sceneProgress);
             const h = maxBarHeight * (currentVal / maxValue);
             const x = gap + i * (barWidth + gap);
             const y = bottomY - h;

             ctx.fillStyle = accentColor + 'cc';
             ctx.beginPath();
             ctx.roundRect(x, y, barWidth, h, { tl: rMin(4), tr: rMin(4), bl: 0, br: 0 });
             ctx.fill();

             ctx.fillStyle = '#ffffff';
             ctx.font = `${rFontY(12)}px Inter, sans-serif`;
             ctx.textAlign = 'center';
             ctx.fillText(data[i].label || '', x + barWidth/2, bottomY + rY(10));

             if (sceneProgress > 0.7) {
                ctx.globalAlpha = alpha * ((sceneProgress - 0.7) / 0.3);
                ctx.font = `${rFontY(11)}px Inter, sans-serif`;
                ctx.fillText(Math.floor(currentVal), x + barWidth/2, y - rY(15));
                ctx.globalAlpha = alpha;
             }
           }
         }
      }
    }

    ctx.restore();
  }
}


