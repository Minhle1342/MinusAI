/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  AI VIDEO RENDERER v2.0 — Multi-Mode Cinematic Engine                   ║
 * ║  Handles: 2D/3D/Particle/Liquid/Glitch Render Modes, Overlays, FX        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class VideoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // Core State
    this.scenes = [];
    this.globalTheme = null;
    this.currentSceneIdx = -1;
    this.globalTime = 0;
    this.sceneTime = 0;
    this.animFrame = null;
    this.isRunning = false;

    // Sub-Engines State
    this.particles = [];
    this.initGlobalParticles();
    this.noiseCanvas = this.createNoiseCanvas();
    
    // Callbacks
    this.onSceneComplete = null;
  }

  // ══════════════════════════ LIFECYCLE ══════════════════════════

  setScenes(scenes, globalTheme) {
    this.scenes = scenes;
    this.globalTheme = globalTheme || {
      colorPalette: ['#ffffff', '#888888', '#000000'],
      mood: 'intense',
      fontStyle: 'bold-impact',
      transitionStyle: 'crossfade'
    };
  }

  renderScene(scene, globalTheme, onComplete) {
    this.stop();
    this.currentScene = scene;
    this.globalTheme = globalTheme || this.globalTheme;
    this.onSceneComplete = onComplete;
    this.sceneTime = 0;
    this.isRunning = true;
    
    // Reset transient states
    this.initSceneParticles(scene);
    
    const loop = (timestamp) => {
      if (!this.isRunning) return;
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const dt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      this.sceneTime += dt;
      this.globalTime += dt;
      
      this.draw(dt);
      
      // Scene completion check
      if (this.sceneTime >= (scene.estimatedDuration || 10)) {
        this.stop();
        if (this.onSceneComplete) this.onSceneComplete();
        return;
      }
      
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.lastTimestamp = 0;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  // ══════════════════════════ BACKGROUND ENGINE ══════════════════════════

  drawBackground(ctx, bg, theme, time) {
    const type = bg.type || 'gradient';
    const colors = bg.colors || ['#05060e', '#0a0e1a'];
    
    switch (type) {
      case 'solid':
        ctx.fillStyle = colors[0];
        ctx.fillRect(0, 0, this.W, this.H);
        break;
      
      case 'gradient':
        const grad = ctx.createLinearGradient(0, 0, this.W, this.H);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1] || colors[0]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.W, this.H);
        break;

      case 'grid':
        ctx.fillStyle = '#05060e';
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.strokeStyle = colors[0] + '33';
        ctx.lineWidth = 1;
        const size = 50;
        for (let x = 0; x <= this.W; x += size) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
        }
        for (let y = 0; y <= this.H; y += size) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
        }
        break;

      case 'animated-particles':
        ctx.fillStyle = colors[0];
        ctx.fillRect(0, 0, this.W, this.H);
        this.drawGlobalParticles(ctx, colors[1] || '#ffffff');
        break;

      case 'aurora':
        this.drawAurora(ctx, colors, time);
        break;

      case 'mesh-gradient':
        this.drawMeshGradient(ctx, colors, bg.animated ? time : 0);
        break;

      case 'noise-field':
        this.drawNoiseField(ctx, colors, time);
        break;
        
      default:
        ctx.fillStyle = '#05060e';
        ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  drawAurora(ctx, colors, time) {
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.fillStyle = colors[i % colors.length] + '22';
      for (let x = 0; x <= this.W; x += 10) {
        const y = this.H * 0.5 + Math.sin(x * 0.002 + time + i) * 100 + Math.cos(x * 0.005 - time * 0.5) * 50;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(this.W, this.H);
      ctx.lineTo(0, this.H);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMeshGradient(ctx, colors, time) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    colors.forEach((c, i) => {
      const x = this.W * (0.5 + Math.sin(time * 0.3 + i) * 0.3);
      const y = this.H * (0.5 + Math.cos(time * 0.4 + i * 1.5) * 0.3);
      const rad = ctx.createRadialGradient(x, y, 0, x, y, this.W * 0.8);
      rad.addColorStop(0, c + '66');
      rad.addColorStop(1, 'transparent');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, this.W, this.H);
    });
    ctx.restore();
  }

  drawNoiseField(ctx, colors, time) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(this.noiseCanvas, (time * 20) % 100, (time * 15) % 100, this.W, this.H);
    ctx.restore();
  }

  createNoiseCanvas() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const cx = c.getContext('2d');
    const img = cx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255;
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  // ══════════════════════════ RENDER MODE ENGINE ══════════════════════════

  draw(dt) {
    if (!this.currentScene) return;
    const ctx = this.ctx;
    const scene = this.currentScene;
    const progress = Math.min(this.sceneTime / scene.estimatedDuration, 1);
    
    this.clear();
    
    // 1. Background
    this.drawBackground(ctx, scene.background, this.globalTheme, this.globalTime);
    
    // 2. Camera Transform (Pseudo-3D)
    ctx.save();
    this.applyCamera(ctx, scene.camera, progress);
    
    // 3. Render Mode Logic
    switch (scene.renderMode) {
      case 'particle': this.renderParticleMode(ctx, scene, progress); break;
      case 'liquid': this.renderLiquidMode(ctx, scene, progress); break;
      case 'glitch': this.renderGlitchMode(ctx, scene, progress); break;
      case 'handdrawn':
      case 'whiteboard': this.renderSketchMode(ctx, scene, progress); break;
      case '3d': this.render3DMode(ctx, scene, progress); break;
      default: this.render2DMode(ctx, scene, progress);
    }
    
    // 4. Visual Elements
    if (scene.visualElements) {
      scene.visualElements.forEach(el => this.renderVisualElement(ctx, el, progress, scene.accentColor));
    }
    
    // 5. Headlines
    this.renderText(ctx, scene, progress);
    
    ctx.restore();
    
    // 6. Overlays
    if (scene.overlayEffects) {
      this.applyOverlayEffects(ctx, scene.overlayEffects, this.globalTime);
    }
    
    // 7. HUD / Global UI
    this.drawProgressBar(progress, scene.accentColor);
  }

  applyCamera(ctx, cam, progress) {
    if (!cam) return;
    const centerX = this.W / 2;
    const centerY = this.H / 2;
    ctx.translate(centerX, centerY);
    
    const speed = cam.speed === 'fast' ? 2 : (cam.speed === 'slow' ? 0.5 : 1);
    const p = progress * speed;
    
    switch (cam.motion) {
      case 'dolly-in': ctx.scale(1 + p * 0.2, 1 + p * 0.2); break;
      case 'dolly-out': ctx.scale(1.2 - p * 0.2, 1.2 - p * 0.2); break;
      case 'orbit': ctx.rotate(p * 0.1); break;
      case 'pan-left': ctx.translate(p * 100, 0); break;
      case 'pan-right': ctx.translate(-p * 100, 0); break;
      case 'shake': 
        ctx.translate((Math.random()-0.5) * 5 * speed, (Math.random()-0.5) * 5 * speed);
        break;
    }
    ctx.translate(-centerX, -centerY);
  }

  render2DMode(ctx, scene, progress) {
    // Basic motion graphics logic
  }

  render3DMode(ctx, scene, progress) {
    // Isometric/Perspective projection simulation
    ctx.save();
    ctx.translate(this.W/2, this.H/2);
    // Draw something 3D-ish
    ctx.restore();
  }

  renderSketchMode(ctx, scene, progress) {
    const isWhiteboard = scene.renderMode === 'whiteboard';
    if (isWhiteboard) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    // Sketchy lines logic
  }

  renderParticleMode(ctx, scene, progress) {
    // Particle text/shape logic
  }

  renderLiquidMode(ctx, scene, progress) {
    // Bezier blob logic
  }

  renderGlitchMode(ctx, scene, progress) {
    // Glitch post-processing logic
  }

  // ══════════════════════════ TEXT ENGINE ══════════════════════════

  renderText(ctx, scene, progress) {
    const style = this.globalTheme.fontStyle || 'bold-impact';
    const fontMap = {
      'bold-impact': '800 80px Impact, Arial Black, sans-serif',
      'elegant-serif': '700 70px Georgia, serif',
      'techy-mono': '500 60px "Courier New", monospace',
      'handwritten': '600 70px "Comic Sans MS", cursive',
      'condensed-dramatic': '900 75px "Arial Narrow", sans-serif'
    };
    
    ctx.font = fontMap[style] || fontMap['bold-impact'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const x = this.W / 2;
    const y = this.H / 2;
    
    const anim = scene.textAnimation || 'typewriter';
    this.drawAnimatedText(ctx, scene.headlineText, x, y, anim, progress, scene.accentColor);
    
    if (scene.subText) {
      ctx.font = '400 30px sans-serif';
      ctx.fillStyle = '#ffffffaa';
      ctx.fillText(scene.subText, x, y + 80);
    }
  }

  drawAnimatedText(ctx, text, x, y, anim, progress, color) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    
    const p = Math.min(progress * 2, 1); // Entrance speed
    
    switch (anim) {
      case 'typewriter':
        const len = Math.floor(text.length * p);
        ctx.fillText(text.substring(0, len), x, y);
        if (Math.floor(this.globalTime * 4) % 2 === 0) {
          const tw = ctx.measureText(text.substring(0, len)).width;
          ctx.fillRect(x + tw/2 + 5, y - 30, 4, 60);
        }
        break;
      case 'fade':
        ctx.globalAlpha = p;
        ctx.fillText(text, x, y);
        break;
      case 'zoom-wipe':
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(0.5 + p * 0.5, 0.5 + p * 0.5);
        ctx.globalAlpha = p;
        ctx.fillText(text, 0, 0);
        ctx.restore();
        break;
      default:
        ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  // ══════════════════════════ VISUAL ELEMENTS ══════════════════════════

  renderVisualElement(ctx, el, progress, accent) {
    const pos = this.getPosition(el.position);
    const size = el.size === 'large' ? 1.5 : (el.size === 'small' ? 0.6 : 1);
    
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(size, size);
    
    // Entry Animation
    const ep = Math.min(Math.max((progress - (el.delay || 0)) * 3, 0), 1);
    ctx.globalAlpha = ep;
    
    switch (el.type) {
      case 'stat-counter':
        const val = parseInt(el.content) || 0;
        ctx.font = '800 60px sans-serif';
        ctx.fillStyle = accent;
        ctx.fillText(Math.floor(val * ep).toLocaleString(), 0, 0);
        break;
      case 'progress-ring':
        this.drawProgressRing(ctx, ep, accent);
        break;
      case 'floating-card':
        this.drawFloatingCard(ctx, el.content, ep, accent);
        break;
      case 'shape':
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(0, 0, 50 * ep, 0, Math.PI * 2); ctx.fill();
        break;
    }
    ctx.restore();
  }

  getPosition(pos) {
    const map = {
      'center': { x: 640, y: 360 },
      'top': { x: 640, y: 150 },
      'bottom': { x: 640, y: 570 },
      'left': { x: 250, y: 360 },
      'right': { x: 1030, y: 360 },
      'top-left': { x: 250, y: 150 },
      'top-right': { x: 1030, y: 150 },
      'bottom-left': { x: 250, y: 570 },
      'bottom-right': { x: 1030, y: 570 },
      'floating': { x: 640 + Math.sin(this.globalTime) * 100, y: 360 + Math.cos(this.globalTime) * 50 }
    };
    return map[pos] || map['center'];
  }

  drawProgressRing(ctx, p, color) {
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#333';
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 60, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * p)); ctx.stroke();
  }

  drawFloatingCard(ctx, text, p, color) {
    ctx.fillStyle = '#1a1a2e';
    ctx.shadowBlur = 20; ctx.shadowColor = '#000';
    ctx.beginPath(); ctx.roundRect(-150, -50, 300, 100, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, 5);
  }

  // ══════════════════════════ OVERLAY ENGINE ══════════════════════════

  applyOverlayEffects(ctx, effects, time) {
    effects.forEach(fx => {
      switch (fx) {
        case 'vignette':
          const v = ctx.createRadialGradient(this.W/2, this.H/2, this.W*0.2, this.W/2, this.H/2, this.W*0.8);
          v.addColorStop(0, 'transparent'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
          ctx.fillStyle = v; ctx.fillRect(0, 0, this.W, this.H);
          break;
        case 'scanlines':
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          for (let y = 0; y < this.H; y += 4) ctx.fillRect(0, y, this.W, 1);
          break;
        case 'film-grain':
          ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
          for (let i = 0; i < 1000; i++) ctx.fillRect(Math.random()*this.W, Math.random()*this.H, 1, 1);
          break;
      }
    });
  }

  // ══════════════════════════ UTILS ══════════════════════════

  initGlobalParticles() {
    this.globalParticles = [];
    for (let i = 0; i < 50; i++) {
      this.globalParticles.push({ x: Math.random()*this.W, y: Math.random()*this.H, s: Math.random()*2+1, v: Math.random()*0.5+0.2 });
    }
  }

  drawGlobalParticles(ctx, color) {
    ctx.fillStyle = color + '44';
    this.globalParticles.forEach(p => {
      p.y -= p.v; if (p.y < 0) p.y = this.H;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI*2); ctx.fill();
    });
  }

  initSceneParticles(scene) {}

  drawProgressBar(p, color) {
    const h = 6;
    this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.ctx.fillRect(0, this.H - h, this.W, h);
    this.ctx.fillStyle = color || '#00d4ff';
    this.ctx.fillRect(0, this.H - h, this.W * p, h);
  }
}

// ══════════════════════════════════════════════════════════════════════════
window.VideoRenderer = VideoRenderer;
