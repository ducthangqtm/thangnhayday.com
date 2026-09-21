import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

// ============================================================
// RacerAudio — Hệ thống âm thanh tổng hợp riêng cho Đua Xe Neon
// Web Audio API thuần (không tải file ngoài)
// ============================================================
class RacerAudio {
  constructor() {
    this.ctx = null;
    // Engine loop nodes
    this._engineOsc = null;
    this._engineGain = null;
    this._engineStarted = false;
  }

  // Khởi tạo AudioContext sau user gesture (tránh Safari autoplay policy)
  _ensureCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  // ------------------------------------------------------------------
  // 1. Engine Sound Loop — sawtooth 60-140 Hz, pitch theo tốc độ xe
  // ------------------------------------------------------------------
  startEngine(speed = 7, isMuted = false) {
    if (isMuted || !this._ensureCtx()) return;

    // Nếu engine đang chạy rồi thì chỉ update pitch
    if (this._engineStarted) {
      this._setEngineFreq(speed);
      return;
    }

    try {
      this._engineOsc = this.ctx.createOscillator();
      this._engineGain = this.ctx.createGain();

      this._engineOsc.type = 'sawtooth';
      this._engineOsc.frequency.setValueAtTime(this._speedToHz(speed), this.ctx.currentTime);

      this._engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this._engineGain.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.4); // Fade-in mượt

      this._engineOsc.connect(this._engineGain);
      this._engineGain.connect(this.ctx.destination);
      this._engineOsc.start();
      this._engineStarted = true;
    } catch (e) {}
  }

  // Cập nhật pitch động cơ theo tốc độ xe (gọi mỗi frame từ update())
  updateEngine(speed, isNitro = false, isMuted = false) {
    if (isMuted) {
      this.stopEngine();
      return;
    }
    if (!this._engineStarted) {
      this.startEngine(speed, isMuted);
      return;
    }
    if (!this.ctx || !this._engineOsc || !this._engineGain) return;

    try {
      const targetHz = this._speedToHz(speed) * (isNitro ? 1.35 : 1.0);
      const now = this.ctx.currentTime;
      this._engineOsc.frequency.cancelScheduledValues(now);
      this._engineOsc.frequency.setTargetAtTime(targetHz, now, 0.12); // Smooth pitch slide

      const targetGain = isNitro ? 0.13 : 0.07;
      this._engineGain.gain.cancelScheduledValues(now);
      this._engineGain.gain.setTargetAtTime(targetGain, now, 0.1);
    } catch (e) {}
  }

  stopEngine() {
    if (!this._engineStarted || !this.ctx || !this._engineGain || !this._engineOsc) {
      this._engineStarted = false;
      return;
    }
    try {
      const now = this.ctx.currentTime;
      this._engineGain.gain.cancelScheduledValues(now);
      this._engineGain.gain.setTargetAtTime(0.0, now, 0.15); // Fade-out mượt
      this._engineOsc.stop(now + 0.6);
    } catch (e) {}
    this._engineOsc = null;
    this._engineGain = null;
    this._engineStarted = false;
  }

  _speedToHz(speed) {
    // speed: 7 (bình thường) -> ~80Hz, 13 (tối đa) -> ~140Hz
    return 60 + (speed - 7) * 9.5;
  }

  _setEngineFreq(speed) {
    if (!this.ctx || !this._engineOsc) return;
    try {
      this._engineOsc.frequency.setTargetAtTime(
        this._speedToHz(speed), this.ctx.currentTime, 0.12
      );
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // 2. Whoosh — vượt xe: 400Hz → 150Hz, 0.18s, dạng sóng triangle
  // ------------------------------------------------------------------
  playWhoosh(isMuted = false) {
    if (isMuted || !this._ensureCtx()) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + dur);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // 3. Power-up Arpeggio — ăn Nitro: 2 nốt C5→G5 (523→784Hz)
  // ------------------------------------------------------------------
  playPowerUp(isMuted = false) {
    if (isMuted || !this._ensureCtx()) return;
    try {
      const notes = [523, 784]; // C5, G5
      const now = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.22, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.22);
      });
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // 4. Crash Explosion — va chạm / húc văng: Noise burst + sub boom
  // ------------------------------------------------------------------
  playCrash(isMuted = false) {
    if (isMuted || !this._ensureCtx()) return;
    try {
      const now = this.ctx.currentTime;
      const sampleRate = this.ctx.sampleRate;
      const duration = 0.32;
      const bufferSize = Math.floor(sampleRate * duration);

      // Noise buffer (điện trắng tắt dần)
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + duration);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + duration);

      // Sub boom — gia tăng cảm giác vật lý va đập
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'triangle';
      boomOsc.frequency.setValueAtTime(90, now);
      boomOsc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
      boomGain.gain.setValueAtTime(0.30, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      boomOsc.connect(boomGain);
      boomGain.connect(this.ctx.destination);
      boomOsc.start(now);
      boomOsc.stop(now + 0.25);
    } catch (e) {
      // Fallback: single oscillator nếu createBuffer thất bại (iOS giới hạn RAM)
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } catch (_) {}
    }
  }

  // Dọn dẹp hoàn toàn AudioContext
  destroy() {
    this.stopEngine();
    if (this.ctx) {
      try { this.ctx.close(); } catch (e) {}
      this.ctx = null;
    }
  }
}

/**
 * RacerGame: Game Đua Xe Neon (Cyber Racer)
 * Phong cách đồ họa Neon Synthwave (Siêu Xe F1 / Supercar, Outrun 80s)
 * - 3 làn xe chạy thẳng thông thoáng
 * - Xe phóng to ~25% chi tiết sắc sảo
 * - Cơ chế tính điểm vượt mọi xe (+10), lách gắt (+20) & điểm sinh tồn theo tốc độ
 * - Bất tử húc văng khi Nitro (4s)
 * Kế thừa chuẩn BaseGame.js
 */
export class RacerGame extends BaseGame {
  constructor() {
    super();

    this.width = 380;
    this.height = 540;
    this.highScore = parseInt(localStorage.getItem('racer_high_score') || '0', 10);

    // Thông số người chơi (Siêu Xe F1 / Supercar - Phóng to ~25%)
    this.player = {
      x: 190,
      y: 430,
      targetX: 190,
      width: 48,
      height: 84,
      tilt: 0, // Độ nghiêng khi chuyển làn (-1 sang 1)
      speed: 7,
      baseSpeed: 7,
      nitro: false,
      nitroTimer: 0,
      nitroMaxTime: 240, // 4 giây ở 60fps (BẤT TỬ / HÚC VĂNG)
      trailHistory: []
    };

    // Đường đua (3 làn xe chạy thẳng thông thoáng)
    this.numLanes = 3;
    this.roadMargin = 20;
    this.roadWidth = 0;
    this.laneWidth = 0;
    this.roadScroll = 0;

    // Danh sách thực thể
    this.traffic = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];

    // Bộ đếm & Điểm sinh tồn
    this.spawnTimer = 0;
    this.spawnInterval = 75;
    this.distanceTraveled = 0;
    this.survivalScoreAccumulator = 0;
    this.nitroMultiplier = 1;

    // Phím bấm & Cảm ứng
    this.keys = {};
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isTouchDragging = false;
    this.mouseStartX = 0;
    this.isMouseDragging = false;

    // Hệ thống âm thanh tổng hợp riêng cho Đua Xe Neon
    this.racerAudio = new RacerAudio();
    this.isMuted = soundEngine.isMuted(); // Đồng bộ trạng thái từ nút Loa chung

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.setupCanvas();
    this.state = 'START';

    this.addListener(window, 'resize', this.handleResize);

    // Lắng nghe thay đổi nút Loa chung để đồng bộ isMuted & dừng/khởi engine sound
    this._muteCheckInterval = setInterval(() => {
      const nowMuted = soundEngine.isMuted();
      if (nowMuted !== this.isMuted) {
        this.isMuted = nowMuted;
        if (this.isMuted) {
          this.racerAudio.stopEngine();
        } else if (this.state === 'PLAYING') {
          this.racerAudio.startEngine(this.player.speed, this.isMuted);
        }
      }
    }, 500);

    // 1. Điều khiển cảm ứng lướt tương đối (Relative Touch Drag) mượt mà cho Safari iOS
    const handleTouchStart = (e) => {
      // Khởi tạo AudioContext ngay sau gesture đầu tiên (Safari autoplay policy)
      this.racerAudio._ensureCtx();
      if (this.state === 'START' || this.state === 'IDLE') {
        this.start();
        return;
      }
      if (this.state !== 'PLAYING') return;

      if (e.touches && e.touches.length > 0) {
        this.isTouchDragging = true;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (!this.isTouchDragging || this.state !== 'PLAYING') return;
      if (e.cancelable) e.preventDefault(); // Chặn cuộn trang iOS Safari

      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const dx = touch.clientX - this.touchStartX;
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;

        // Lướt xe mượt mà theo độ dời ngón tay
        this.player.targetX += dx * 1.35;
        this.clampPlayerX();
      }
    };

    const handleTouchEnd = () => {
      this.isTouchDragging = false;
    };

    // 2. Chạm 2 nửa màn hình trái/phải để chuyển làn nhanh
    const handleCanvasClick = (e) => {
      this.racerAudio._ensureCtx(); // Đảm bảo AudioContext được mở trên PC
      if (this.state === 'START' || this.state === 'IDLE') {
        this.start();
        return;
      }
      if (this.state !== 'PLAYING') return;

      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const mid = rect.width / 2;

      // Nudge nhẹ sang làn kế bên nếu chỉ tap mà không vuốt
      if (!this.isTouchDragging) {
        const nudge = this.laneWidth * 0.85;
        if (clickX < mid) {
          this.player.targetX -= nudge;
        } else {
          this.player.targetX += nudge;
        }
        this.clampPlayerX();
      }
    };

    this.addListener(this.canvas, 'touchstart', handleTouchStart, { passive: false });
    this.addListener(window, 'touchmove', handleTouchMove, { passive: false });
    this.addListener(window, 'touchend', handleTouchEnd);
    this.addListener(window, 'touchcancel', handleTouchEnd);
    this.addListener(this.canvas, 'click', handleCanvasClick);

    // 3. Chuột kéo trên PC
    const handleMouseDown = (e) => {
      this.racerAudio._ensureCtx();
      if (this.state === 'START' || this.state === 'IDLE') {
        this.start();
        return;
      }
      if (this.state !== 'PLAYING') return;
      this.isMouseDragging = true;
      this.mouseStartX = e.clientX;
    };

    const handleMouseMove = (e) => {
      if (!this.isMouseDragging || this.state !== 'PLAYING') return;
      const dx = e.clientX - this.mouseStartX;
      this.mouseStartX = e.clientX;
      this.player.targetX += dx * 1.25;
      this.clampPlayerX();
    };

    const handleMouseUp = () => {
      this.isMouseDragging = false;
    };

    this.addListener(this.canvas, 'mousedown', handleMouseDown);
    this.addListener(window, 'mousemove', handleMouseMove);
    this.addListener(window, 'mouseup', handleMouseUp);

    // 4. Bàn phím PC (A/D & Mũi tên)
    const handleKeyDown = (e) => {
      this.racerAudio._ensureCtx();
      this.keys[e.code] = true;
      if ((this.state === 'START' || this.state === 'IDLE') &&
          ['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        this.start();
      }
    };
    const handleKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this.addListener(window, 'keydown', handleKeyDown);
    this.addListener(window, 'keyup', handleKeyUp);

    this.drawStartScreen();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const viewport = document.getElementById('canvasViewport');
    const viewportW = viewport && viewport.clientWidth > 0 ? viewport.clientWidth : window.innerWidth;
    const viewportH = viewport && viewport.clientHeight > 0 ? viewport.clientHeight : window.innerHeight;

    const width = Math.floor(Math.min(viewportW > 0 ? viewportW * 0.94 : 380, 400));
    const height = Math.floor(Math.min(viewportH > 150 ? viewportH : 530, 560));

    // Khóa dpr tối đa ở mức 2 để chống giật lag / nóng máy Safari iOS
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // CSS chống cuộn và chọn văn bản
    this.canvas.style.touchAction = 'none';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';
    this.canvas.style.webkitTouchCallout = 'none';

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;

    this.roadWidth = this.width - this.roadMargin * 2;
    this.laneWidth = this.roadWidth / this.numLanes; // ~113px cho 3 làn

    this.player.y = this.height - 95;
    this.player.x = this.getLaneCenterX(1); // Làn giữa
    this.player.targetX = this.player.x;
  }

  handleResize() {
    this.setupCanvas();
    if (this.state === 'START' || this.state === 'IDLE') {
      this.drawStartScreen();
    }
  }

  getLaneCenterX(laneIndex) {
    return this.roadMargin + laneIndex * this.laneWidth + this.laneWidth / 2;
  }

  clampPlayerX() {
    const minX = this.roadMargin + this.player.width / 2 + 6;
    const maxX = this.width - this.roadMargin - this.player.width / 2 - 6;
    this.player.targetX = Math.max(minX, Math.min(maxX, this.player.targetX));
  }

  start() {
    this.removeGameOverOverlay();
    this.state = 'PLAYING';
    this.score = 0;
    this.distanceTraveled = 0;
    this.survivalScoreAccumulator = 0;
    this.updateScore(0);
    this.isMuted = soundEngine.isMuted(); // Đồng bộ mute state trước khi bắt đầu

    this.player.speed = this.player.baseSpeed;
    this.player.nitro = false;
    this.player.nitroTimer = 0;
    this.player.x = this.getLaneCenterX(1); // Làn giữa
    this.player.targetX = this.player.x;
    this.player.tilt = 0;
    this.player.trailHistory = [];

    this.traffic = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnTimer = 0;
    this.spawnInterval = 75;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Khởi động âm thanh động cơ (fade in từ đầu)
    this.racerAudio.stopEngine();
    this.racerAudio.startEngine(this.player.speed, this.isMuted);

    soundEngine.playBlip(320, 0.08);
    this.animationId = requestAnimationFrame(this.loop);
  }

  // ================= GAMEPLAY LOOP =================
  loop() {
    if (this.state !== 'PLAYING') return;

    this.update();
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  }

  update() {
    // 1. Điều khiển bàn phím (A/D, ArrowLeft/Right)
    const steerSpeed = 6.0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
      this.player.targetX -= steerSpeed;
      this.clampPlayerX();
    }
    if (this.keys['ArrowRight'] || this.keys['KeyD']) {
      this.player.targetX += steerSpeed;
      this.clampPlayerX();
    }

    // 2. Nội suy chuyển động xe mượt mà (Smooth Lerp)
    const dx = this.player.targetX - this.player.x;
    this.player.x += dx * 0.18;
    // Tính góc nghiêng thân xe khi rẽ
    const targetTilt = Math.max(-1, Math.min(1, dx / 8));
    this.player.tilt += (targetTilt - this.player.tilt) * 0.2;

    // 3. Cơ chế Tốc độ & Nitro hợp lý (Tăng 25-30% mượt mà, Bất tử trong 4 giây)
    const normalSpeed = Math.min(13, this.player.baseSpeed + Math.floor(this.distanceTraveled / 1000) * 0.5);

    if (this.player.nitro) {
      this.player.nitroTimer--;
      // Tốc độ chỉ tăng thêm khoảng 28%, tăng mượt qua lerp không phóng vọt mất kiểm soát
      const targetSpeed = normalSpeed * 1.28;
      this.player.speed += (targetSpeed - this.player.speed) * 0.12;
      this.nitroMultiplier = 2;

      // Sinh hạt hào quang năng lượng quanh xe
      if (Math.random() < 0.6) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 32,
          y: this.player.y + (Math.random() - 0.5) * 55,
          vx: (Math.random() - 0.5) * 2.5,
          vy: Math.random() * 2 + 1,
          color: Math.random() < 0.5 ? '#facc15' : '#00f3ff',
          size: Math.random() * 3 + 1.5,
          alpha: 1,
          decay: 0.04
        });
      }

      if (this.player.nitroTimer <= 0) {
        this.player.nitro = false;
        this.nitroMultiplier = 1;
      }
    } else {
      // Giảm dần mượt mà về tốc độ bình thường sau khi hết Nitro
      this.player.speed += (normalSpeed - this.player.speed) * 0.08;
    }

    // Cuộn đường cao tốc
    this.roadScroll = (this.roadScroll + this.player.speed) % 60;
    this.distanceTraveled += this.player.speed;

    // Cập nhật pitch động cơ theo tốc độ & trạng thái Nitro (mỗi frame)
    this.racerAudio.updateEngine(this.player.speed, this.player.nitro, this.isMuted);

    // 4. ĐIỂM SINH TỒN THEO THỜI GIAN & TỐC ĐỘ:
    // Càng chạy nhanh điểm tích lũy sinh tồn càng tăng nhanh
    this.survivalScoreAccumulator += this.player.speed * 0.04 * this.nitroMultiplier;
    if (this.survivalScoreAccumulator >= 1) {
      const addPts = Math.floor(this.survivalScoreAccumulator);
      this.survivalScoreAccumulator -= addPts;
      this.score += addPts;
      this.updateScore(this.score);
    }

    // Giảm dần spawnInterval theo quãng đường để tăng tần suất xe cản đường
    this.spawnInterval = Math.max(38, 75 - Math.floor(this.distanceTraveled / 1200) * 4);

    // Lưu vết đèn hậu (Light trail)
    this.player.trailHistory.push({
      x: this.player.x,
      y: this.player.y + this.player.height / 2 - 4,
      nitro: this.player.nitro
    });
    if (this.player.trailHistory.length > 6) {
      this.player.trailHistory.shift();
    }

    // 5. Sinh xe chướng ngại vật (Traffic Spawning - Chống đè xe)
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnTrafficWave();
    }

    // 6. Cập nhật xe lưu thông & Đảm bảo khoảng cách an toàn (Chống đè xe)
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      // Tốc độ tương đối: Xe người chơi chạy nhanh hơn xe cản đường
      const relSpeed = this.player.speed - car.speed;
      car.y += relSpeed;

      // Giữ khoảng cách tối thiểu với xe phía trước trên cùng làn đường (> 160px)
      for (let j = 0; j < this.traffic.length; j++) {
        if (i === j) continue;
        const other = this.traffic[j];
        if (car.lane === other.lane) {
          const dy = other.y - car.y;
          // Nếu xe khác ở dưới (phía trước) và khoảng cách < 160px
          if (dy > 0 && dy < 160) {
            car.y = other.y - 160;
            car.speed = Math.max(car.speed, other.speed);
          }
        }
      }

      // 7. ĐIỂM VƯỢT XE TỔNG QUÁT & THƯỞNG LÁCH GẮT:
      // Khi bất kỳ xe cản đường nào trôi qua mũi xe người chơi (trafficCar.y > player.y && !trafficCar.passed)
      if (!car.passed && car.y > this.player.y) {
        car.passed = true;

        // Âm thanh "Vút" xé gió khi vượt qua xe (Whoosh SFX)
        this.racerAudio.playWhoosh(this.isMuted);

        // Điểm vượt xe tổng quát: +10 điểm (áp dụng cho TẤT CẢ các làn đường)
        const passPts = 10 * this.nitroMultiplier;
        this.score += passPts;

        // Hiệu ứng: Hiện chữ "+10" nhỏ bay lên và mờ dần tại vị trí đuôi chiếc xe vừa vượt qua
        const tailY = car.y + car.height / 2;
        this.floatingTexts.push({
          x: car.x,
          y: tailY,
          text: `+${passPts}`,
          color: '#00f3ff',
          alpha: 1,
          vy: -1.0
        });

        // Thưởng thêm lách sát sườn (Near Miss Bonus): +20 điểm kèm dòng chữ "LÁCH GẮT! +20"
        const dx = Math.abs(car.x - this.player.x);
        const nearMissThreshold = (this.player.width / 2 + car.width / 2) + 26; // Rất gần sườn xe (~73-76px)
        if (dx < nearMissThreshold) {
          const bonusPts = 20 * this.nitroMultiplier;
          this.score += bonusPts;
          soundEngine.playScore();

          this.floatingTexts.push({
            x: (car.x + this.player.x) / 2,
            y: tailY - 16,
            text: `LÁCH GẮT! +${bonusPts}`,
            color: '#facc15',
            alpha: 1,
            vy: -1.4
          });
        }

        this.updateScore(this.score);
      }

      // Xóa xe trôi ra ngoài biên
      if (car.y > this.height + 120 || car.y < -150) {
        this.traffic.splice(i, 1);
        continue;
      }

      // Va chạm với xe người chơi
      if (this.checkCollision(this.player, car)) {
        if (this.player.nitro) {
          // TRẠNG THÁI BẤT TỬ / HÚC VĂNG (+50 điểm, không Game Over)
          this.handleSmashCar(car, i);
          continue;
        } else {
          // Va chạm thông thường -> Game Over
          this.handleCrash(car);
          return;
        }
      }
    }

    // 8. Cập nhật vật phẩm Nitro
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const item = this.powerups[i];
      item.y += this.player.speed - 3;
      item.angle = (item.angle || 0) + 0.05;

      if (item.y > this.height + 40) {
        this.powerups.splice(i, 1);
        continue;
      }

      // Nhặt vật phẩm
      const pBox = {
        x: this.player.x,
        y: this.player.y,
        width: this.player.width,
        height: this.player.height
      };
      if (this.checkCollision(pBox, item)) {
        this.collectPowerup(item);
        this.powerups.splice(i, 1);
      }
    }

    // 9. Cập nhật hạt hiệu ứng (Particles)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 10. Cập nhật chữ bay (Floating texts)
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // ================= TRAFFIC & SPAWN LOGIC (3 LÀN XE, CHỐNG ĐÈ XE) =================
  spawnTrafficWave() {
    const availableLanes = [0, 1, 2]; // 3 làn xe
    const spawnY = -120;
    const minVerticalGap = 180; // Khoảng cách dọc tối thiểu chống đè xe

    // Lọc các làn đường mà ở vị trí spawn dự kiến (spawnY) không có xe nào gần hơn 180px
    const validLanes = availableLanes.filter(lane => {
      return !this.traffic.some(c => c.lane === lane && Math.abs(c.y - spawnY) < minVerticalGap);
    });

    if (validLanes.length === 0) return;

    // Trên 3 làn xe, LUÔN LUÔN giữ ít nhất 1 làn trống để người chơi lách qua:
    // Nếu cả 3 làn đều trống: có thể spawn 1 hoặc tối đa 2 xe.
    // Nếu chỉ có 2 làn trống: chỉ spawn 1 xe.
    const countToSpawn = (Math.random() < 0.35 && validLanes.length >= 3) ? 2 : 1;

    for (let k = 0; k < countToSpawn; k++) {
      if (validLanes.length <= 1) break; // Luôn giữ ít nhất 1 làn trống
      const idx = Math.floor(Math.random() * validLanes.length);
      const lane = validLanes.splice(idx, 1)[0];

      // Loại xe: 78% Xe con thể thao, 22% Xe tải
      const isTruck = Math.random() < 0.22;
      const colors = ['#ec4899', '#ef4444', '#f97316', '#a855f7', '#3b82f6'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      // TẤT CẢ xe chạy cùng chiều hướng lên trên nhưng tốc độ chậm hơn người chơi (3.4 - 5.2)
      const carSpeed = isTruck ? 3.4 : (4.2 + Math.random() * 1.4);

      // Kích thước xe phóng to ~25% cho 3 làn
      const trafficCar = {
        lane: lane,
        x: this.getLaneCenterX(lane),
        y: spawnY - k * 50,
        width: isTruck ? 52 : 46,
        height: isTruck ? 116 : 78,
        isTruck: isTruck,
        color: color,
        speed: carSpeed,
        passed: false
      };

      this.traffic.push(trafficCar);
    }

    // 15% cơ hội sinh bình Nitro trên 1 làn trống (không đè lên xe cản đường)
    if (Math.random() < 0.15 && this.powerups.length < 2 && validLanes.length > 0) {
      const nitroLane = validLanes[Math.floor(Math.random() * validLanes.length)];
      const hasCarNear = this.traffic.some(c => c.lane === nitroLane && Math.abs(c.y - (-140)) < 120);
      if (!hasCarNear) {
        this.powerups.push({
          lane: nitroLane,
          x: this.getLaneCenterX(nitroLane),
          y: -140,
          width: 28,
          height: 28,
          angle: 0
        });
      }
    }
  }

  checkCollision(rect1, rect2) {
    // Khung va chạm (Hitbox) chính xác theo kích thước xe mới
    const p1x = 7;
    const p1y = 8;
    const p2x = 5;
    const p2y = 6;

    const r1 = {
      left: rect1.x - (rect1.width / 2) + p1x,
      right: rect1.x + (rect1.width / 2) - p1x,
      top: rect1.y - (rect1.height / 2) + p1y,
      bottom: rect1.y + (rect1.height / 2) - p1y
    };

    const r2 = {
      left: rect2.x - (rect2.width / 2) + p2x,
      right: rect2.x + (rect2.width / 2) - p2x,
      top: rect2.y - (rect2.height / 2) + p2y,
      bottom: rect2.y + (rect2.height / 2) - p2y
    };

    return !(r1.left > r2.right || r1.right < r2.left || r1.top > r2.bottom || r1.bottom < r2.top);
  }

  collectPowerup(item) {
    this.player.nitro = true;
    this.player.nitroTimer = this.player.nitroMaxTime; // 240 frames = 4s
    // Arpeggio Nitro SFX (C5→G5) của RacerAudio thay thế soundEngine.playPowerUp() chung
    this.racerAudio.playPowerUp(this.isMuted);

    // Hạt nổ bung màu vàng
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const spd = Math.random() * 3.5 + 2;
      this.particles.push({
        x: item.x,
        y: item.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: '#facc15',
        size: Math.random() * 3 + 2,
        alpha: 1,
        decay: 0.04
      });
    }

    this.floatingTexts.push({
      x: item.x,
      y: item.y - 12,
      text: '⚡ BẤT TỬ / HÚC VĂNG! 4S',
      color: '#facc15',
      alpha: 1,
      vy: -1.5
    });
  }

  // Khi đang Nitro húc văng xe khác (+50 điểm, nổ tung, không Game Over)
  handleSmashCar(car, index) {
    this.traffic.splice(index, 1);
    // Crash SFX của RacerAudio (Noise burst + sub boom) thay thế soundEngine.playExplosion() chung
    this.racerAudio.playCrash(this.isMuted);

    const smashBonus = 50;
    this.score += smashBonus;
    this.updateScore(this.score);

    // Nổ tia lửa hoành tráng
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 6 + 2;
      this.particles.push({
        x: car.x,
        y: car.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: Math.random() < 0.4 ? '#facc15' : (Math.random() < 0.5 ? '#00f3ff' : '#ff0055'),
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: 0.035
      });
    }

    this.floatingTexts.push({
      x: car.x,
      y: car.y - 12,
      text: '+50 HÚC VĂNG! 💥',
      color: '#facc15',
      alpha: 1,
      vy: -1.6
    });
  }

  handleCrash(car) {
    // Dừng hẳn tiếng động cơ khi Game Over
    this.racerAudio.stopEngine();
    // Crash SFX nổ tung + sub boom
    this.racerAudio.playCrash(this.isMuted);

    // Sinh tia lửa nổ tại điểm va chạm
    const crashX = (this.player.x + car.x) / 2;
    const crashY = (this.player.y + car.y) / 2;
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 1.5;
      this.particles.push({
        x: crashX,
        y: crashY,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: Math.random() < 0.5 ? '#ff0055' : '#00f3ff',
        size: Math.random() * 3.5 + 1.5,
        alpha: 1,
        decay: 0.03
      });
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('racer_high_score', this.highScore.toString());
    }

    this.triggerGameOver(this.score);

    this.showGameOverOverlay({
      title: '💥 VA CHẠM!',
      score: this.score,
      highScore: this.highScore,
      subtitle: 'Đường cao tốc Neon rực lửa. Thử lại để bứt phá kỷ lục!'
    });
  }

  // ================= RENDER GRAPHICS (3 LÀN NEON SYNTHWAVE) =================
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Mặt đường tối sẫm (#09090b)
    ctx.fillStyle = '#09090b';
    ctx.fillRect(this.roadMargin, 0, this.roadWidth, this.height);

    // Lề đường ngoài
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, this.roadMargin, this.height);
    ctx.fillRect(this.width - this.roadMargin, 0, this.roadMargin, this.height);

    // 2. Gờ lề đường Synthwave (Curbs) - KHÔNG dùng shadowBlur
    const curbH = 20;
    const curbOffset = this.roadScroll % (curbH * 2);
    for (let y = -curbH * 2; y < this.height + curbH * 2; y += curbH) {
      const isPink = Math.floor((y + curbOffset) / curbH) % 2 === 0;
      ctx.fillStyle = isPink ? '#d946ef' : '#3b0764';
      ctx.fillRect(this.roadMargin - 6, y + curbOffset, 6, curbH);
      ctx.fillRect(this.width - this.roadMargin, y + curbOffset, 6, curbH);
    }

    // Viền Neon Hồng sắc nét 2 bên mép đường
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.roadMargin, 0);
    ctx.lineTo(this.roadMargin, this.height);
    ctx.moveTo(this.width - this.roadMargin, 0);
    ctx.lineTo(this.width - this.roadMargin, this.height);
    ctx.stroke();

    // 3. CHỈ VẼ 2 DẢI VẠCH KẺ ĐỨT ĐOẠN NGĂN CÁCH 3 LÀN XE (Yellow/Cyan) - KHÔNG dùng shadowBlur
    const dashLen = 32;
    const gapLen = 24;
    const totalDash = dashLen + gapLen;
    const dashOffset = (this.roadScroll * 1.5) % totalDash;

    ctx.lineWidth = 2.0;
    ctx.setLineDash([dashLen, gapLen]);
    ctx.lineDashOffset = -dashOffset;

    for (let i = 1; i < this.numLanes; i++) {
      const laneX = this.roadMargin + i * this.laneWidth;
      ctx.beginPath();
      // 2 vạch đứt đoạn phân làn: 1 Cyan Neon, 1 Vàng Neon tạo phong cách Synthwave
      ctx.strokeStyle = i === 1 ? '#00f3ff' : '#facc15';
      ctx.moveTo(laneX, 0);
      ctx.lineTo(laneX, this.height);
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // 4. Vẽ xe giao thông (Traffic Cars - Tất cả cùng chiều, có đèn hậu đỏ)
    for (const car of this.traffic) {
      this.drawTrafficCar(ctx, car);
    }

    // 5. Vẽ vật phẩm (Nitro Power-ups)
    for (const item of this.powerups) {
      this.drawPowerup(ctx, item);
    }

    // 6. Vẽ xe người chơi (Siêu xe F1 / Supercar Neon Cyan phóng to 25%)
    this.drawPlayerCar(ctx);

    // 7. Vẽ các hạt tia sáng (Particles)
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 8. Vẽ chữ bay (Floating texts)
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = '900 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 9. HUD trên Canvas
    this.drawHUD(ctx);
  }

  /**
   * Thiết kế SIÊU XE F1 / SUPERCAR Người Chơi (Phóng to ~25% cho 3 làn đường):
   * - Mũi xe vuốt nhọn khí động học viền Neon Cyan (#00f3ff)
   * - 4 bánh xe thể thao đen/xám nhô rõ ra 4 góc hông xe
   * - Kính lái vòng cung đen bóng bẩy có điểm sáng phản chiếu
   * - Cánh gió đuôi (Spoiler) thể thao ngang ở đuôi xe
   * - 2 vệt LED đỏ rực ở đuôi xe có vệt sáng nhẹ kéo theo
   * - Hào quang năng lượng bảo vệ khi Nitro (Bất tử / húc văng)
   */
  drawPlayerCar(ctx) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt * 0.08); // Nghiêng xe mượt mà khi rẽ

    const w = p.width;   // 48 (phóng to)
    const h = p.height;  // 84 (phóng to)
    const hw = w / 2;    // 24
    const hh = h / 2;    // 42

    // A. Vệt sáng LED đỏ kéo theo sau đuôi xe (Light Trails)
    ctx.save();
    const trailLen = p.nitro ? 52 : 30;
    const trailGrad = ctx.createLinearGradient(0, hh - 2, 0, hh + trailLen);
    if (p.nitro) {
      trailGrad.addColorStop(0, '#facc15');
      trailGrad.addColorStop(0.4, 'rgba(0, 243, 255, 0.7)');
      trailGrad.addColorStop(1, 'rgba(0, 243, 255, 0)');
    } else {
      trailGrad.addColorStop(0, '#ff0033');
      trailGrad.addColorStop(0.4, 'rgba(255, 0, 51, 0.6)');
      trailGrad.addColorStop(1, 'rgba(255, 0, 51, 0)');
    }
    ctx.fillStyle = trailGrad;
    // 2 dải vệt sáng đèn hậu LED
    ctx.fillRect(-hw + 7, hh - 2, 6, trailLen);
    ctx.fillRect(hw - 13, hh - 2, 6, trailLen);
    ctx.restore();

    // B. BÁNH XE THỂ THAO (4 bánh xe bản rộng nhô ra ở 4 góc)
    const steerAngle = p.tilt * 0.22;
    const drawWheel = (wx, wy, ww, wh, isFront) => {
      ctx.save();
      ctx.translate(wx + ww / 2, wy + wh / 2);
      if (isFront) ctx.rotate(steerAngle);
      // Lốp cao su thể thao
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-ww / 2, -wh / 2, ww, wh, 3);
      ctx.fill();
      ctx.stroke();
      // Viền mâm lazang thể thao Cyan
      ctx.fillStyle = p.nitro ? '#facc15' : '#00f3ff';
      ctx.fillRect(-1, -wh / 2 + 4, 2, wh - 8);
      ctx.restore();
    };

    // Bánh trước trái & phải (nhô ra 4 góc)
    drawWheel(-hw - 5, -hh + 12, 8, 20, true);
    drawWheel(hw - 3, -hh + 12, 8, 20, true);

    // Bánh sau trái & phải (bánh bản rộng thể thao)
    drawWheel(-hw - 6, hh - 30, 9, 22, false);
    drawWheel(hw - 3, hh - 30, 9, 22, false);

    // C. CÁNH GIÓ TRƯỚC (Front Splitter / Wing)
    ctx.fillStyle = '#0e7490';
    ctx.fillRect(-hw - 3, -hh + 8, w + 6, 5);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-hw - 3, -hh + 8, w + 6, 5);

    // D. THÂN SIÊU XE F1 / SUPERCAR (Khí động học, thắt eo, mũi nhọn)
    ctx.beginPath();
    ctx.moveTo(0, -hh);                  // Mũi nhọn khí động học
    ctx.lineTo(7, -hh + 16);             // Cạnh mũi phải
    ctx.lineTo(hw - 8, -hh + 18);        // Cánh gió trước phải
    ctx.lineTo(10, -hh + 28);            // Thắt eo buồng lái phải
    ctx.lineTo(hw - 1, -hh + 40);        // Hốc hút gió sườn (Sidepod) phải
    ctx.lineTo(hw - 4, hh - 14);         // Đuôi hông phải
    ctx.lineTo(hw - 7, hh - 3);          // Khuyếch tán gió sau phải
    ctx.lineTo(-hw + 7, hh - 3);         // Khuyếch tán gió sau trái
    ctx.lineTo(-hw + 4, hh - 14);        // Đuôi hông trái
    ctx.lineTo(-hw + 1, -hh + 40);       // Hốc hút gió sườn trái
    ctx.lineTo(-10, -hh + 28);           // Thắt eo buồng lái trái
    ctx.lineTo(-hw + 8, -hh + 18);       // Cánh gió trước trái
    ctx.lineTo(-7, -hh + 16);            // Cạnh mũi trái
    ctx.closePath();

    // Màu sơn Siêu Xe: Gradient Xanh Cyan Neon bóng bẩy
    const bodyGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
    if (p.nitro) {
      bodyGrad.addColorStop(0, '#facc15');
      bodyGrad.addColorStop(0.3, '#fef08a');
      bodyGrad.addColorStop(0.5, '#ffffff'); // Highlight chói lòa
      bodyGrad.addColorStop(0.7, '#fef08a');
      bodyGrad.addColorStop(1, '#facc15');
    } else {
      bodyGrad.addColorStop(0, '#0891b2');
      bodyGrad.addColorStop(0.25, '#06b6d4');
      bodyGrad.addColorStop(0.5, '#67e8f9'); // Highlight gờ sống giữa xe
      bodyGrad.addColorStop(0.75, '#06b6d4');
      bodyGrad.addColorStop(1, '#0891b2');
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Viền Neon Cyan sắc sảo
    ctx.strokeStyle = p.nitro ? '#ffffff' : '#00f3ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Sống mũi xe (Center aerodynamic crease)
    ctx.strokeStyle = p.nitro ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -hh + 1);
    ctx.lineTo(0, -hh + 18);
    ctx.stroke();

    // Khe hút gió 2 bên sườn (Sidepod vents)
    ctx.fillStyle = '#020617';
    ctx.fillRect(-hw + 3, -hh + 38, 4, 12);
    ctx.fillRect(hw - 7, -hh + 38, 4, 12);

    // E. KÍNH LÁI VÒNG CUNG (Windshield - Đen bóng bẩy có điểm sáng phản chiếu)
    ctx.save();
    ctx.beginPath();
    // Vẽ kính lái hình vòng cung oval khí động học
    ctx.ellipse(0, -hh + 33, 9, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Điểm sáng phản chiếu vòng cung trên kính lái
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -hh + 33, 6.5, Math.PI * 0.9, Math.PI * 1.5);
    ctx.stroke();

    // Đốm sáng phản quang nhỏ (Specular Glint)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-3, -hh + 28, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Khe tản nhiệt động cơ sau lưng lái (Engine deck louvers)
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, hh - 22);
    ctx.lineTo(6, hh - 22);
    ctx.moveTo(-6, hh - 17);
    ctx.lineTo(6, hh - 17);
    ctx.moveTo(-6, hh - 12);
    ctx.lineTo(6, hh - 12);
    ctx.stroke();

    // F. CÁNH GIÓ ĐUÔI (Spoiler - Thanh ngang thể thao ở đuôi xe)
    // 2 chân đỡ cánh gió
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7, hh - 8, 3, 6);
    ctx.fillRect(4, hh - 8, 3, 6);
    // Thanh cánh gió ngang
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(-hw - 2, hh - 7, w + 4, 6);
    ctx.strokeStyle = p.nitro ? '#fef08a' : '#00f3ff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-hw - 2, hh - 7, w + 4, 6);
    // 2 vách ép gió cánh đuôi (Endplates)
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(-hw - 4, hh - 10, 2.5, 10);
    ctx.fillRect(hw + 1.5, hh - 10, 2.5, 10);

    // G. ĐÈN HẬU: 2 VỆT LED ĐỎ RỰC Ở ĐUÔI XE
    ctx.save();
    ctx.shadowColor = '#ff0033';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(-hw + 6, hh - 3, 8, 3);
    ctx.fillRect(hw - 14, hh - 3, 8, 3);
    // Reset shadow tức thì
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();

    // H. HÀO QUANG NĂNG LƯỢNG BẢO VỆ (Trạng thái Bất tử / Húc văng khi Nitro)
    if (p.nitro) {
      ctx.save();
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 54, 0, Math.PI * 2);
      ctx.stroke();

      // Vòng hào quang phụ Cyan
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Vẽ xe chướng ngại vật (Traffic Cars / Trucks):
   * - TẤT CẢ chạy cùng chiều hướng lên trên (Đường 3 làn một chiều)
   * - Đèn pha chiếu sáng về phía trước (hướng lên khoảng xa)
   * - Đuôi xe sáng 2 đèn hậu đỏ hướng về người chơi
   */
  drawTrafficCar(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);

    const w = car.width;
    const h = car.height;
    const hw = w / 2;
    const hh = h / 2;

    // A. Đèn pha chiếu sáng về phía trước (Hướng lên trên xa)
    ctx.save();
    const beamGrad = ctx.createLinearGradient(0, -hh, 0, -hh - 55);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
    ctx.fillStyle = beamGrad;

    ctx.beginPath();
    ctx.moveTo(-hw + 5, -hh);
    ctx.lineTo(-hw - 10, -hh - 50);
    ctx.lineTo(-hw + 14, -hh - 50);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(hw - 5, -hh);
    ctx.lineTo(hw - 14, -hh - 50);
    ctx.lineTo(hw + 10, -hh - 50);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // B. Thân xe con hoặc xe tải (chạy cùng chiều hướng lên trên)
    if (car.isTruck) {
      // XE TẢI NEON (Thùng hàng ở đuôi, cabin đầu kéo ở trước)
      // Thùng hàng ở sau
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-hw, -hh + 28, w, h - 28);
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw, -hh + 28, w, h - 28);

      // Vạch sọc cảnh báo trên thùng xe tải
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-hw + 5, -hh + 44);
      ctx.lineTo(hw - 5, -hh + 44);
      ctx.moveTo(-hw + 5, -hh + 64);
      ctx.lineTo(hw - 5, -hh + 64);
      ctx.moveTo(-hw + 5, -hh + 84);
      ctx.lineTo(hw - 5, -hh + 84);
      ctx.stroke();

      // Đầu kéo cabin phía trước (-hh)
      ctx.fillStyle = car.color;
      ctx.fillRect(-hw + 2, -hh, w - 4, 28);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-hw + 2, -hh, w - 4, 28);

      // Kính trước đầu kéo
      ctx.fillStyle = '#09090b';
      ctx.fillRect(-hw + 7, -hh + 5, w - 14, 10);

      // Đèn pha trước (vàng)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-hw + 5, -hh, 7, 2.5);
      ctx.fillRect(hw - 12, -hh, 7, 2.5);

      // ĐÈN HẬU ĐỎ Ở ĐUÔI XE TẢI (Hướng về người chơi)
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(-hw + 4, hh - 3.5, 8, 3.5);
      ctx.fillRect(hw - 12, hh - 3.5, 8, 3.5);
    } else {
      // XE THỂ THAO NEON ĐỊCH (Chạy cùng chiều)
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, w, h, 8);
      ctx.fillStyle = '#18181b';
      ctx.fill();
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Nóc xe & mui
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-hw + 5, -hh + 16, w - 10, h - 32, 5);
      ctx.fill();

      // Kính trước & kính sau
      ctx.fillStyle = '#09090b';
      ctx.fillRect(-hw + 7, -hh + 16, w - 14, 7); // Kính trước
      ctx.fillRect(-hw + 7, hh - 23, w - 14, 7);  // Kính sau

      // Đèn pha trước màu vàng sáng (ở phía -hh)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-hw + 5, -hh, 7, 2.5);
      ctx.fillRect(hw - 12, -hh, 7, 2.5);

      // 2 ĐÈN HẬU ĐỎ RỰC Ở ĐUÔI XE (ở phía hh - hướng về người chơi)
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(-hw + 5, hh - 3.5, 8, 3.5);
      ctx.fillRect(hw - 13, hh - 3.5, 8, 3.5);
    }

    ctx.restore();
  }

  /**
   * Vẽ vật phẩm Nitro / Tia sét phát sáng vàng rực
   */
  drawPowerup(ctx, item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);

    // Bật shadowBlur cục bộ cho vật phẩm
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;

    // Vòng tròn hào quang
    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // Biểu tượng tia sét vàng neon
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(1, -11);
    ctx.lineTo(-8, 1);
    ctx.lineTo(-1, 1);
    ctx.lineTo(-3, 11);
    ctx.lineTo(8, -1);
    ctx.lineTo(1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Reset shadowBlur
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  /**
   * HUD hiển thị điểm, tốc độ và thanh Nitro
   */
  drawHUD(ctx) {
    ctx.save();

    // Badge Nitro ở góc trên bên trái khi đang kích hoạt
    if (this.player.nitro) {
      const nitroRatio = Math.max(0, this.player.nitroTimer / this.player.nitroMaxTime);
      const remainingSec = (this.player.nitroTimer / 60).toFixed(1);
      const barW = 112;
      const barH = 10;
      const x = this.roadMargin + 8;
      const y = 14;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.roundRect(x - 4, y - 4, barW + 8, barH + 22, 6);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.font = '900 9.5px system-ui, sans-serif';
      ctx.fillText(`⚡ BẤT TỬ / HÚC VĂNG (${remainingSec}s)`, x, y + 7);

      // Thanh tiến trình Nitro
      ctx.fillStyle = '#334155';
      ctx.fillRect(x, y + 12, barW, 4);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x, y + 12, barW * nitroRatio, 4);
    }

    // Tốc độ km/h góc trên bên phải
    const speedKmh = Math.floor(this.player.speed * 18);
    ctx.textAlign = 'right';
    ctx.font = '900 13px monospace';
    ctx.fillStyle = this.player.nitro ? '#facc15' : '#00f3ff';
    ctx.fillText(`${speedKmh} KM/H`, this.width - this.roadMargin - 8, 24);

    ctx.restore();
  }

  /**
   * Màn hình chờ bắt đầu (Start Screen)
   */
  drawStartScreen() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Nền đường
    ctx.fillStyle = '#09090b';
    ctx.fillRect(this.roadMargin, 0, this.roadWidth, this.height);
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.roadMargin, 0, this.roadWidth, this.height);

    // Vẽ xe người chơi mẫu ở giữa
    this.player.x = this.width / 2;
    this.player.y = this.height * 0.58;
    this.drawPlayerCar(ctx);

    // Tiêu đề Synthwave
    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#00f3ff';
    ctx.fillText('CYBER RACER', this.width / 2, this.height * 0.26);

    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#d946ef';
    ctx.fillText('ĐUA XE NEON 3 LÀN F1', this.width / 2, this.height * 0.31);

    // Hướng dẫn
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Vượt xe (+10) | Lách gắt (+20) | Sinh tồn theo tốc độ', this.width / 2, this.height * 0.38);
    ctx.fillText('Nhặt ⚡ Nitro: Bất tử húc văng xe khác (+50đ)', this.width / 2, this.height * 0.42);

    // Nút chạm để chơi nhấp nháy
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = '#facc15';
    ctx.fillText('CHẠM MÀN HÌNH ĐỂ BẮT ĐẦU ▶', this.width / 2, this.height * 0.78);

    ctx.restore();
  }

  destroy() {
    // Dọn dẹp interval đồng bộ mute
    if (this._muteCheckInterval) {
      clearInterval(this._muteCheckInterval);
      this._muteCheckInterval = null;
    }
    // Dọn dẹp hoàn toàn AudioContext + engine oscillator
    this.racerAudio.destroy();

    super.destroy();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
