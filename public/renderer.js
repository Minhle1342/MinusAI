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
    for (let i = 0; i < 80; i++) {
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

    // Animated radial gradient center
    const cx = this.W * 0.5 + Math.sin(t * 0.3) * 80;
    const cy = this.H * 0.5 + Math.cos(t * 0.2) * 40;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.H * 0.9);
    for (const s of stops) {
      grad.addColorStop(s.pos, s.color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Subtle accent radial bloom
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
    bloom.addColorStop(0, accentColor + '18');
    bloom.addColorStop(1, 'transparent');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grid lines (subtle)
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    const gridSpacing = 80;
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

  // ── Decorative Elements ───────────────────────────────────────────────────
  drawDecorativeLines(accentColor, alpha, t) {
    const ctx = this.ctx;
    ctx.save();

    // Center horizontal accent line
    const lineY = this.H * 0.5 + 60;
    const lineW = 280 * alpha;
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;

    // Left line
    ctx.beginPath();
    ctx.moveTo(this.W/2 - lineW - 20, lineY);
    ctx.lineTo(this.W/2 - 20, lineY);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(this.W/2 + 20, lineY);
    ctx.lineTo(this.W/2 + lineW + 20, lineY);
    ctx.stroke();

    // Center dot
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.W/2, lineY, 3, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    // Corner accents
    const cSize = 30 * alpha;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.4;
    // top-left
    ctx.beginPath(); ctx.moveTo(40, 40 + cSize); ctx.lineTo(40, 40); ctx.lineTo(40 + cSize, 40); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(this.W-40-cSize, 40); ctx.lineTo(this.W-40, 40); ctx.lineTo(this.W-40, 40+cSize); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(40, this.H-40-cSize); ctx.lineTo(40, this.H-40); ctx.lineTo(40+cSize, this.H-40); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(this.W-40-cSize, this.H-40); ctx.lineTo(this.W-40, this.H-40); ctx.lineTo(this.W-40, this.H-40-cSize); ctx.stroke();

    ctx.restore();
  }

  // ── Text Rendering ────────────────────────────────────────────────────────
  drawTitle(text, animStyle, progress, accentColor, renderMode = 'default', timestamp = 0) {
    const ctx = this.ctx;
    const centerX = this.W / 2;
    const centerY = this.H / 2;

    let x = centerX, y = centerY - 20;
    let alpha = 1, scale = 1, blur = 0;
    let charProgress = 1;

    const ease = this.easeOutQuart(Math.min(progress * 1.5, 1));
    const easeIn = this.easeInQuad(Math.max(0, progress * 2 - 1));

    switch (animStyle) {
      case 'slide-up':
        y = centerY - 20 + (1 - ease) * 80;
        alpha = ease;
        break;
      case 'slide-left':
        x = centerX + (1 - ease) * 120;
        alpha = ease;
        break;
      case 'zoom-in':
        scale = 0.4 + ease * 0.6;
        alpha = ease;
        break;
      case 'fade-in':
        alpha = ease;
        blur = (1 - ease) * 8;
        break;
      case 'typewriter':
        charProgress = Math.min(progress * 3, 1);
        alpha = 1;
        break;
      default:
        alpha = ease;
        y = centerY - 20 + (1 - ease) * 60;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (blur > 0) ctx.filter = `blur(${blur}px)`;

    // Glow shadow
    if (renderMode === 'hand-drawn') {
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 30;
      if (renderMode === 'neon') {
        ctx.shadowBlur = 30 + Math.sin(timestamp / 400) * 8;
      }
    }

    // Display text (typewriter: partial chars)
    let displayText = text;
    if (animStyle === 'typewriter' && charProgress < 1) {
      displayText = text.slice(0, Math.floor(charProgress * text.length));
    }

    // Large title font
    const fontSize = this.calcFontSize(text, 96, this.W - 160);
    if (renderMode === 'hand-drawn') {
      ctx.font = `800 ${fontSize}px 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', system-ui, sans-serif`;
    } else {
      ctx.font = `800 ${fontSize}px 'Space Grotesk', system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.02em';

    // Gradient fill for text
    const textGrad = ctx.createLinearGradient(-200, -fontSize/2, 200, fontSize/2);
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.5, '#f0f0f5');
    textGrad.addColorStop(1, accentColor + 'cc');
    ctx.fillStyle = textGrad;
    ctx.fillText(displayText, 0, 0);

    // Typing cursor
    if (animStyle === 'typewriter' && charProgress < 1) {
      const tw = ctx.measureText(displayText).width;
      ctx.fillStyle = accentColor;
      ctx.fillRect(tw/2 + 6, -fontSize/2, 4, fontSize);
    }

    // neon effect
    if (renderMode === 'neon') {
      const layers = [
        { blur: 10, alpha: 0.6 },
        { blur: 25, alpha: 0.4 },
        { blur: 50, alpha: 0.2 }
      ];
      layers.forEach(layer => {
        ctx.shadowBlur = layer.blur + Math.sin(timestamp / 400) * 8;
        ctx.shadowColor = accentColor;
        ctx.globalAlpha = alpha * layer.alpha;
        ctx.fillText(displayText, 0, 0);
      });
    }

    // hand-drawn sketch border
    if (renderMode === 'hand-drawn') {
      const tw = ctx.measureText(displayText).width;
      const th = fontSize;
      const padX = 20;
      const padY = 10;
      const bx = -tw/2 - padX;
      const by = -th/2 - padY;
      const bw = tw + padX * 2;
      const bh = th + padY * 2;

      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const jitter = () => (Math.random() - 0.5) * 6;
      ctx.moveTo(bx + jitter(), by + jitter());
      ctx.lineTo(bx + bw + jitter(), by + jitter());
      ctx.lineTo(bx + bw + jitter(), by + bh + jitter());
      ctx.lineTo(bx + jitter(), by + bh + jitter());
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  calcFontSize(text, maxSize, maxWidth) {
    let size = maxSize;
    const ctx = this.ctx;
    while (size > 32) {
      ctx.font = `800 ${size}px 'Space Grotesk', system-ui, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 4;
    }
    return size;
  }

  drawSceneNumber(idx, total, accentColor, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;
    ctx.fillText(`${idx + 1} / ${total}`, this.W - 40, 40);
    ctx.restore();
  }

  drawProgressBar(progress, accentColor) {
    const ctx = this.ctx;
    const barH = 3;
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
      ctx.arc(fillW, barY + barH/2, 4, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.restore();
  }

  drawVideoTitle(title, alpha) {
    if (!title) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.font = '500 15px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 40, 36);
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
    for (let x = 0; x < this.W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y < this.H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    ctx.restore();

    // Center logo area
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(this.W/2, this.H/2, 120, 0, Math.PI * 2);
    ctx.strokeStyle = '#747689';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.W/2, this.H/2, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.font = '700 26px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillText('TuanDevTop', this.W/2, this.H/2);
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
  }

  // Start rendering a specific scene
  renderScene(idx) {
    const scene = this.scenes[idx];
    if (!scene) return;

    this.currentSceneIdx = idx;
    this.sceneStartTime = performance.now();
    this.phase = 'entering';
    this.phaseTime = 0;

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this._renderLoop(scene, performance.now());
  }

  _renderLoop(scene, lastTime) {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    this.globalTime += dt;
    this.phaseTime += dt;

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
        this.phaseTime = 0;
        if (this.onSceneTitleShown) this.onSceneTitleShown(this.currentSceneIdx);
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
    this.drawBackground(theme, accent, this.globalTime);
    this.drawParticles(accent);
    this.drawDecorativeLines(accent, Math.min(enterProgress * 1.5, 1) * (1 - exitProgress * 2), this.globalTime);
    this.drawTitle(scene.sceneTitle, animStyle, enterProgress * (1 - exitProgress), accent, renderMode, now);
    
    if (scene.elements && scene.elements.length > 0) {
      const sceneTime = (now - this.sceneStartTime) / 1000;
      const duration = scene.duration || scene.estimatedDuration || 5;
      const sceneProgress = Math.min(sceneTime / duration, 1);
      
      scene.elements.forEach(element => {
        const position = VisualElementRenderer.resolvePosition(element.position, this.W, this.H);
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
        
        const offscreen = document.createElement('canvas');
        offscreen.width = this.W;
        offscreen.height = this.H;
        offscreen.getContext('2d').putImageData(newImageData, 0, 0);
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.3;
        ctx.drawImage(offscreen, 0, 0);
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
  exitScene() {
    if (this.phase === 'displaying' || this.phase === 'entering') {
      this.phase = 'exiting';
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
  }

  // Draw completion frame (Ends abruptly as requested)
  drawCompletionFrame() {
    this.stop();
  }
}

// Export
window.VideoRenderer = VideoRenderer;

class VisualElementRenderer {
  static resolvePosition(positionString, canvasWidth, canvasHeight) {
    switch(positionString) {
      case 'bottom-left':   return { x: 40, y: canvasHeight - 180 };
      case 'bottom-center': return { x: (canvasWidth - 320) / 2, y: canvasHeight - 200 };
      case 'bottom-right':  return { x: canvasWidth - 320, y: canvasHeight - 180 };
      case 'center-left':   return { x: 40, y: (canvasHeight - 120) / 2 };
      case 'center-right':  return { x: canvasWidth - 300, y: (canvasHeight - 120) / 2 };
      default: return { x: 40, y: canvasHeight - 180 }; // fallback
    }
  }

  static draw(ctx, element, sceneProgress, accentColor, position) {
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const alpha = Math.min(1, sceneProgress * 4);
    if (alpha <= 0) return;

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.globalAlpha = alpha;

    if (element.type === 'stat-counter') {
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(0, 0, 260, 120, 12);
      ctx.fill();

      // Left border
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(0, 0, 4, 120, { tl: 12, bl: 12, tr: 0, br: 0 });
      ctx.fill();

      // Top label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '14px Inter, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText((element.label || '').toUpperCase(), 20, 20);

      // Animated number
      const targetVal = element.value || 0;
      const currentVal = Math.floor(targetVal * easeOutCubic(sceneProgress));
      const prefix = element.prefix || '';
      const suffix = element.suffix || '';
      const formatted = currentVal.toLocaleString('en-US');

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px Inter, sans-serif';
      ctx.fillText(`${prefix}${formatted}${suffix}`, 20, 50);

    } else if (element.type === 'progress-bar') {
      // Top label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText((element.label || '').toUpperCase(), 0, 0);

      // Track background
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(0, 30, 280, 10, 5);
      ctx.fill();

      // Fill bar
      const targetPct = Math.min(Math.max(element.percent || 0, 0), 100);
      const currentPct = targetPct * easeOutCubic(sceneProgress);
      const fillWidth = 280 * (currentPct / 100);

      if (fillWidth > 0) {
        const grad = ctx.createLinearGradient(0, 0, fillWidth, 0);
        grad.addColorStop(0, accentColor);
        grad.addColorStop(1, accentColor + '40');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(0, 30, fillWidth, 10, 5);
        ctx.fill();

        // Moving dot
        ctx.fillStyle = accentColor;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(fillWidth, 35, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      // Percentage text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.floor(currentPct)}%`, 290, 35);

    } else if (element.type === 'chart') {
      const data = element.data || [];
      const dataCount = data.length;
      const chartWidth = 320;
      const chartHeight = 180;
      const bottomY = chartHeight - 20;

      // Title
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText((element.label || ''), 0, 0);

      // Axes
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(0, bottomY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(0, bottomY);
      ctx.lineTo(chartWidth, bottomY);
      ctx.stroke();

      if (dataCount > 0) {
        const maxValue = Math.max(...data.map(d => d.value || 0), 1);
        const maxBarHeight = chartHeight - 60;
        const gap = 10;
        const totalGap = gap * (dataCount + 1);
        const barWidth = Math.max(2, (chartWidth - totalGap) / dataCount);

        if (element.chartType === 'line') {
           const points = [];
           for (let i = 0; i < dataCount; i++) {
             const val = data[i].value || 0;
             const x = gap + i * (barWidth + gap) + barWidth / 2;
             const targetY = bottomY - (maxBarHeight * (val / maxValue));
             points.push({ x, y: targetY });

             ctx.fillStyle = '#ffffff';
             ctx.font = '12px Inter, sans-serif';
             ctx.textAlign = 'center';
             ctx.fillText(data[i].label || '', x, bottomY + 10);
           }
           
           const drawProgressX = chartWidth * easeOutCubic(sceneProgress);

           ctx.save();
           ctx.beginPath();
           ctx.rect(0, 0, drawProgressX, chartHeight);
           ctx.clip();

           ctx.beginPath();
           ctx.moveTo(points[0].x, bottomY);
           for (let i = 0; i < dataCount; i++) ctx.lineTo(points[i].x, points[i].y);
           ctx.lineTo(points[dataCount-1].x, bottomY);
           ctx.closePath();
           const areaGrad = ctx.createLinearGradient(0, 30, 0, bottomY);
           areaGrad.addColorStop(0, accentColor + '4d');
           areaGrad.addColorStop(1, 'transparent');
           ctx.fillStyle = areaGrad;
           ctx.fill();

           ctx.beginPath();
           ctx.moveTo(points[0].x, points[0].y);
           for (let i = 1; i < dataCount; i++) ctx.lineTo(points[i].x, points[i].y);
           ctx.strokeStyle = accentColor;
           ctx.lineWidth = 2;
           ctx.stroke();

           ctx.fillStyle = accentColor;
           for (let i = 0; i < dataCount; i++) {
             ctx.beginPath();
             ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
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
             ctx.roundRect(x, y, barWidth, h, { tl: 4, tr: 4, bl: 0, br: 0 });
             ctx.fill();

             ctx.fillStyle = '#ffffff';
             ctx.font = '12px Inter, sans-serif';
             ctx.textAlign = 'center';
             ctx.fillText(data[i].label || '', x + barWidth/2, bottomY + 10);

             if (sceneProgress > 0.7) {
                ctx.globalAlpha = alpha * ((sceneProgress - 0.7) / 0.3);
                ctx.font = '11px Inter, sans-serif';
                ctx.fillText(Math.floor(currentVal), x + barWidth/2, y - 15);
                ctx.globalAlpha = alpha;
             }
           }
        }
      }
    }

    ctx.restore();
  }
}

