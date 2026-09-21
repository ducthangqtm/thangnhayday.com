import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

export class SpaceShooterGame extends BaseGame {
  constructor() {
    super();

    this.width = 380;
    this.height = 520;

    // Tàu người chơi (Khối Arcade đặc sắc bóng bẩy)
    this.player = {
      x: 190,
      y: 440,
      targetX: 190,
      targetY: 440,
      width: 48,
      height: 52,
      speed: 7.5,
      shield: 1, // Tặng 1 khiên bảo hộ khi bắt đầu
      invulnerableTimer: 0,
      weaponType: 'normal', // 'normal', 'triple', 'mega'
      weaponTimer: 0,
      shootCooldown: 0,
      shootInterval: 8 // ~133ms ở 60fps
    };

    // Mảng đối tượng game
    this.stars = [];
    this.lasers = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];

    // Bộ đếm đợt & spawn
    this.spawnTimer = 0;
    this.spawnInterval = 65;
    this.gameTick = 0;
    this.shake = 0;
    this.highScore = parseInt(localStorage.getItem('space_shooter_high_score') || '0', 10);

    // Phím bấm & Touch
    this.keys = {};
    this.isPointerDown = false;
    this.pointerOffsetX = 0;
    this.pointerOffsetY = 0;

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.setupCanvas();
    this.initStars();
    this.state = 'START';

    this.addListener(window, 'resize', this.handleResize);

    // 1. Điều khiển cảm ứng lướt tương đối (Relative Touch Drag) cho Safari iOS & Mobile
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isTouchDragging = false;

    const handleTouchStart = (e) => {
      if (this.state === 'START' || this.state === 'IDLE') {
        this.start();
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
      if (e.cancelable) e.preventDefault(); // Chặn triệt để cuộn trang và cử chỉ Safari iOS

      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;

        // Di chuyển tàu tương đối theo khoảng cách ngón tay kéo
        this.player.x += dx;
        this.player.y += dy;

        // Cập nhật lại mốc chạm
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;

        // Giới hạn (clamp) player.x và player.y không bay ra ngoài mép màn hình Canvas
        const marginX = 22;
        this.player.x = Math.max(marginX, Math.min(this.width - marginX, this.player.x));
        this.player.y = Math.max(this.height * 0.35, Math.min(this.height - 35, this.player.y));
        this.player.targetX = this.player.x;
        this.player.targetY = this.player.y;
      }
    };

    const handleTouchEnd = () => {
      this.isTouchDragging = false;
    };

    // Đăng ký Touch Events với options { passive: false } để e.preventDefault() chặn cuộn trang Safari
    this.addListener(this.canvas, 'touchstart', handleTouchStart, { passive: false });
    this.addListener(window, 'touchmove', handleTouchMove, { passive: false });
    this.addListener(window, 'touchend', handleTouchEnd);
    this.addListener(window, 'touchcancel', handleTouchEnd);

    // 2. Hỗ trợ thêm chuột kéo tương đối trên PC
    this.mouseStartX = 0;
    this.mouseStartY = 0;
    this.isMouseDragging = false;

    const handleMouseDown = (e) => {
      if (this.state === 'START' || this.state === 'IDLE') {
        this.start();
      }
      if (this.state !== 'PLAYING') return;
      this.isMouseDragging = true;
      this.mouseStartX = e.clientX;
      this.mouseStartY = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!this.isMouseDragging || this.state !== 'PLAYING') return;
      const dx = e.clientX - this.mouseStartX;
      const dy = e.clientY - this.mouseStartY;
      this.player.x += dx;
      this.player.y += dy;
      this.mouseStartX = e.clientX;
      this.mouseStartY = e.clientY;

      const marginX = 22;
      this.player.x = Math.max(marginX, Math.min(this.width - marginX, this.player.x));
      this.player.y = Math.max(this.height * 0.35, Math.min(this.height - 35, this.player.y));
      this.player.targetX = this.player.x;
      this.player.targetY = this.player.y;
    };

    const handleMouseUp = () => {
      this.isMouseDragging = false;
    };

    this.addListener(this.canvas, 'mousedown', handleMouseDown);
    this.addListener(window, 'mousemove', handleMouseMove);
    this.addListener(window, 'mouseup', handleMouseUp);

    // Hỗ trợ thêm bàn phím PC
    const handleKeyDown = (e) => {
      this.keys[e.code] = true;
      if ((this.state === 'START' || this.state === 'IDLE') && 
          ['Space', 'Enter', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        this.start();
      }
    };
    const handleKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this.addListener(window, 'keydown', handleKeyDown);
    this.addListener(window, 'keyup', handleKeyUp);

    // Vẽ màn hình chờ ban đầu
    this.drawStartScreen();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const viewport = document.getElementById('canvasViewport');
    const viewportW = viewport && viewport.clientWidth > 0 ? viewport.clientWidth : window.innerWidth;
    const viewportH = viewport && viewport.clientHeight > 0 ? viewport.clientHeight : window.innerHeight;

    const width = Math.floor(Math.min(viewportW > 0 ? viewportW * 0.94 : 380, 400));
    const height = Math.floor(Math.min(viewportH > 150 ? viewportH : 520, 560));

    // Khóa devicePixelRatio tối đa ở mức 2 (thay vì 3 trên Retina iOS như XS Max) để chống nóng máy & tụt pin
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Vô hiệu hóa cử chỉ trễ và cuộn trang của Safari iOS
    this.canvas.style.touchAction = 'none';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';
    this.canvas.style.webkitTouchCallout = 'none';

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;

    this.player.x = width / 2;
    this.player.targetX = width / 2;
    this.player.y = height - 70;
    this.player.targetY = height - 70;
  }

  handleResize() {
    this.setupCanvas();
    this.initStars();
    if (this.state === 'START' || this.state === 'IDLE') {
      this.drawStartScreen();
    }
  }

  /**
   * Nền sao Parallax 3 lớp:
   * - Lớp 1: Sao nhỏ mờ ảo chạy chậm
   * - Lớp 2: Sao vừa neon cyan & tím
   * - Lớp 3: Sao lớn 4 cánh retro chữ thập lấp lánh chạy nhanh
   */
  initStars() {
    this.stars = [];

    // Lớp 1: Sao nhỏ
    for (let i = 0; i < 38; i++) {
      this.stars.push({
        layer: 1,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 0.8 + 0.6,
        speed: Math.random() * 0.6 + 0.4,
        alpha: Math.random() * 0.35 + 0.2,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
        color: '#94a3b8'
      });
    }

    // Lớp 2: Sao vừa
    for (let i = 0; i < 24; i++) {
      this.stars.push({
        layer: 2,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 1.4 + 1.2,
        speed: Math.random() * 1.4 + 1.2,
        alpha: Math.random() * 0.5 + 0.4,
        twinkleSpeed: Math.random() * 0.06 + 0.02,
        color: Math.random() > 0.5 ? '#00f3ff' : '#d946ef'
      });
    }

    // Lớp 3: Sao lớn 4 cánh chữ thập retro
    for (let i = 0; i < 9; i++) {
      this.stars.push({
        layer: 3,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2.5 + 2.5,
        speed: Math.random() * 2.2 + 2.4,
        alpha: Math.random() * 0.4 + 0.6,
        twinkleSpeed: Math.random() * 0.08 + 0.03,
        isCross: true,
        color: Math.random() > 0.4 ? '#00f3ff' : (Math.random() > 0.5 ? '#facc15' : '#ffffff')
      });
    }
  }

  getLevel() {
    return Math.floor(this.score / 500) + 1;
  }

  start() {
    this.removeGameOverOverlay();
    this.state = 'PLAYING';
    this.score = 0;
    this.currentLevel = 1;
    this.gameTick = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 60; // Ban đầu 1000ms (60 frames tại 60fps)
    this.shake = 0;

    this.player.x = this.width / 2;
    this.player.targetX = this.width / 2;
    this.player.y = this.height - 70;
    this.player.targetY = this.height - 70;
    this.player.shield = 1;
    this.player.invulnerableTimer = 0;
    this.player.weaponType = 'normal';
    this.player.weaponTimer = 0;
    this.player.shootCooldown = 0;

    this.lasers = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];

    this.updateScore(0);
    soundEngine.init();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = requestAnimationFrame(this.loop);
  }

  loop() {
    if (this.state !== 'PLAYING') {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      return;
    }

    this.update();
    this.draw();

    if (this.state === 'PLAYING') {
      this.animationId = requestAnimationFrame(this.loop);
    } else {
      this.animationId = null;
    }
  }

  update() {
    this.gameTick++;

    // 1. Cập nhật nền sao Parallax
    for (const star of this.stars) {
      star.y += star.speed;
      if (star.y > this.height) {
        star.y = -5;
        star.x = Math.random() * this.width;
      }
      star.alpha += Math.sin(this.gameTick * star.twinkleSpeed) * 0.025;
      star.alpha = Math.max(0.15, Math.min(1, star.alpha));
    }

    // 2. Điều khiển bàn phím PC
    const speed = this.player.speed;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.player.targetX -= speed;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) this.player.targetX += speed;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) this.player.targetY -= speed;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) this.player.targetY += speed;

    // Giới hạn trong khung màn hình
    const halfW = this.player.width / 2;
    this.player.targetX = Math.max(halfW + 4, Math.min(this.width - halfW - 4, this.player.targetX));
    this.player.targetY = Math.max(this.height * 0.25, Math.min(this.height - 35, this.player.targetY));

    // Di chuyển mượt mà (Lerp)
    this.player.x += (this.player.targetX - this.player.x) * 0.26;
    this.player.y += (this.player.targetY - this.player.y) * 0.26;

    // Thả tàn lửa từ 2 ống xả phản lực phía sau theo từng frame
    if (this.gameTick % 2 === 0) {
      [-11, 11].forEach(ox => {
        this.particles.push({
          x: this.player.x + ox + (Math.random() - 0.5) * 4,
          y: this.player.y + 18,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 2.5 + 2.5,
          size: Math.random() * 2.2 + 1.2,
          color: Math.random() > 0.5 ? '#facc15' : '#ff5500',
          life: 14,
          maxLife: 14,
          isSpark: false
        });
      });
    }

    // Hồi phục sau va chạm
    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer--;
    }

    // Đếm ngược thời gian vũ khí đặc biệt
    if (this.player.weaponTimer > 0) {
      this.player.weaponTimer--;
      if (this.player.weaponTimer <= 0) {
        this.player.weaponType = 'normal';
      }
    }

    // 3. Tự động bắn đạn laser liên tục
    this.player.shootCooldown--;
    if (this.player.shootCooldown <= 0) {
      this.fireLaser();
      this.player.shootCooldown = this.player.shootInterval;
    }

    // 4. Cập nhật đạn laser - Xóa ngay lập tức khi ra ngoài biên (-20 đến height + 20)
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.x += laser.vx;
      laser.y += laser.vy;

      if (laser.y < -20 || laser.y > this.height + 20 || laser.x < -20 || laser.x > this.width + 20) {
        this.lasers.splice(i, 1);
      }
    }

    // 5. Tăng độ khó tự động theo điểm số (Dynamic Difficulty)
    const level = this.getLevel();
    if (level > this.currentLevel) {
      this.currentLevel = level;
      soundEngine.playPowerUp();
      this.floatingTexts.push({
        x: this.width / 2,
        y: this.height * 0.38,
        text: `LEVEL ${level}!`,
        color: '#facc15',
        life: 75
      });
      // Thưởng 1 power-up cứu cánh khi lên cấp mới
      this.spawnPowerUp(this.width * (0.3 + Math.random() * 0.4), -15);
    }

    // Thời gian hồi chiêu sinh kẻ địch (spawnInterval):
    // Ban đầu 1000ms (~60 frames), từ Level 3 trở đi giảm xuống 500ms - 400ms (30 - 24 frames), quái tràn màn hình liên tục!
    this.spawnTimer++;
    const currentInterval = Math.max(24, Math.round(60 - (level - 1) * 9));
    if (this.spawnTimer >= currentInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Rơi vật phẩm (Power-up) cứu cánh tự do khi chiến trường quá ngột ngạt (>= 8 quái trên màn hình)
    if (this.enemies.length >= 8 && this.powerups.length === 0 && this.gameTick % 280 === 0) {
      this.spawnPowerUp(this.width * (0.25 + Math.random() * 0.5), -15);
    }

    // 6. Cập nhật kẻ địch & va chạm với đạn
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.y += enemy.vy;

      // Giảm dần hiệu ứng chớp sáng trắng (hit flash)
      if (enemy.hitFlash > 0) {
        enemy.hitFlash--;
      }

      if (enemy.type === 'drone') {
        // Quái bọ tím bay zíc zắc nhanh và gắt hơn, có xu hướng lao nhẹ về phía vị trí của tàu người chơi
        const dx = this.player.x - enemy.baseX;
        enemy.baseX += Math.sign(dx) * Math.min(Math.abs(dx) * 0.02, 1.1);
        enemy.x = enemy.baseX + Math.sin(this.gameTick * 0.088 + enemy.phase) * enemy.amplitude;
      } else if (enemy.type === 'cruiser') {
        // Quái tiêm kích đỏ chủ động nghiêng và lao nhẹ về phía tàu người chơi
        const dx = this.player.x - enemy.x;
        enemy.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.025, 1.4);
      } else if (enemy.type === 'asteroid') {
        enemy.angle = (enemy.angle !== undefined ? enemy.angle : 0) + (enemy.rotSpeed || 0.02);
        enemy.rotation = enemy.angle;
      }

      // Kiểm tra đạn bắn trúng kẻ địch
      for (let j = this.lasers.length - 1; j >= 0; j--) {
        const laser = this.lasers[j];
        const dist = Math.hypot(laser.x - enemy.x, laser.y - enemy.y);
        const hitRadius = enemy.radius + laser.radius;

        if (dist < hitRadius) {
          enemy.hp -= laser.damage;
          // Kích hoạt chớp sáng trắng (Hit Flash) 2 khung hình tạo cảm giác bắn cực sướng tay
          enemy.hitFlash = 3;

          // Chùm tia chớp nhỏ rực rỡ (Sparks) văng ra
          this.createHitSparks(laser.x, laser.y, enemy.color);

          if (!laser.piercing) {
            this.lasers.splice(j, 1);
          }

          if (enemy.hp <= 0) {
            this.destroyEnemy(enemy, i);
            break;
          }
        }
      }

      // Kiểm tra va chạm với tàu người chơi
      if (enemy && this.player.invulnerableTimer <= 0) {
        const distToPlayer = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
        if (distToPlayer < enemy.radius + 18) {
          if (this.player.shield > 0) {
            this.player.shield--;
            this.player.invulnerableTimer = 80;
            this.shake = 0;
            soundEngine.playShieldHit();
            this.createExplosion(this.player.x, this.player.y, '#00f3ff', 30);
            this.floatingTexts.push({
              x: this.player.x,
              y: this.player.y - 30,
              text: 'KHIÊN ĐỠ!',
              color: '#00f3ff',
              life: 45
            });
            this.destroyEnemy(enemy, i, false);
          } else {
            this.handlePlayerDeath();
            return;
          }
        }
      }

      // Kẻ địch vượt quá mép màn hình: Xóa sạch khi y < -60 hoặc y > this.height + 20
      if (enemy && (enemy.y > this.height + 20 || enemy.y < -60 || enemy.x < -40 || enemy.x > this.width + 40)) {
        this.enemies.splice(i, 1);
      }
    }

    // 7. Cập nhật vật phẩm rơi (Power-ups) - Xóa khi vượt quá mép
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += p.vy;
      p.pulse += 0.08;

      const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (dist < 32) {
        this.collectPowerUp(p);
        this.powerups.splice(i, 1);
        continue;
      }

      if (p.y > this.height + 20 || p.y < -20) {
        this.powerups.splice(i, 1);
      }
    }

    // 8. Cập nhật hạt nổ tia chớp: Xóa ngay lập tức khi y < -20 hoặc y > canvas.height + 20
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life--;
      if (pt.life <= 0 || pt.y < -20 || pt.y > this.height + 20 || pt.x < -20 || pt.x > this.width + 20) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.life--;
      if (ft.life <= 0 || ft.y < -20 || ft.y > this.height + 20) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  fireLaser() {
    soundEngine.playLaser();

    if (this.player.weaponType === 'triple') {
      [-0.22, 0, 0.22].forEach(angle => {
        this.lasers.push({
          x: this.player.x + (angle * 42),
          y: this.player.y - 20,
          vx: Math.sin(angle) * 12,
          vy: -Math.cos(angle) * 15,
          radius: 3.5,
          damage: 1,
          color: '#10b981',
          piercing: false
        });
      });
    } else if (this.player.weaponType === 'mega') {
      this.lasers.push({
        x: this.player.x,
        y: this.player.y - 28,
        vx: 0,
        vy: -17,
        radius: 8,
        damage: 3,
        color: '#ff0055',
        piercing: true
      });
    } else {
      [-16, 16].forEach(offset => {
        this.lasers.push({
          x: this.player.x + offset,
          y: this.player.y - 16,
          vx: 0,
          vy: -14,
          radius: 2.8,
          damage: 1,
          color: '#00f3ff',
          piercing: false
        });
      });
    }
  }

  spawnEnemy() {
    const level = this.getLevel();
    // Tốc độ rơi: Tăng thêm 10% sau mỗi Level (đặt giới hạn max 2.1x để không bị giật khung hình)
    const speedMultiplier = Math.min(2.1, 1 + (level - 1) * 0.1);

    // Đội Hình (Wave/Swarm): Thay vì rơi lẻ tẻ, spawn 2-3 con cùng lúc (hàng ngang hoặc so le)
    let count = 1;
    if (level === 1) {
      count = Math.random() < 0.4 ? 2 : 1;
    } else if (level === 2) {
      count = 2;
    } else {
      count = Math.random() < 0.65 ? 3 : 2;
    }

    const margin = 32;
    if (count === 1) {
      const x = margin + Math.random() * (this.width - margin * 2);
      this.createSingleEnemy(x, -35, level, speedMultiplier);
    } else if (count === 2) {
      // 2 con: Hàng ngang hoặc so le 2 bên
      const x1 = this.width * 0.28 + (Math.random() - 0.5) * 30;
      const x2 = this.width * 0.72 + (Math.random() - 0.5) * 30;
      const isStaggered = Math.random() > 0.5;
      this.createSingleEnemy(x1, -35, level, speedMultiplier);
      this.createSingleEnemy(x2, isStaggered ? -65 : -35, level, speedMultiplier);
    } else {
      // 3 con: Đội hình mũi nhọn (V-formation)
      const centerX = this.width * 0.5 + (Math.random() - 0.5) * 40;
      const spacing = 52;
      const x1 = Math.max(margin, Math.min(this.width - margin, centerX));
      const x2 = Math.max(margin, centerX - spacing);
      const x3 = Math.min(this.width - margin, centerX + spacing);
      this.createSingleEnemy(x1, -35, level, speedMultiplier);
      this.createSingleEnemy(x2, -65, level, speedMultiplier);
      this.createSingleEnemy(x3, -65, level, speedMultiplier);
    }
  }

  createSingleEnemy(spawnX, spawnY, level, speedMultiplier) {
    // Thay đổi tỉ lệ xuất hiện kẻ địch theo điểm số:
    // - Điểm < 500: Chủ yếu là thiên thạch rơi thẳng.
    // - Điểm >= 500: Tăng tỉ lệ quái tiêm kích đỏ/tím bay zíc zắc.
    let asteroidRate, droneRate;
    if (this.score < 500) {
      asteroidRate = 0.75;
      droneRate = 0.18;
    } else if (this.score < 1000) {
      asteroidRate = 0.35;
      droneRate = 0.42;
    } else {
      asteroidRate = 0.20;
      droneRate = 0.45;
    }

    const roll = Math.random();

    if (roll < asteroidRate) {
      // 1. Thiên thạch khối đá (Tốc độ rơi cơ bản tăng 35-50%)
      const baseRadius = 17 + Math.random() * 10;
      const points = [];
      const numPoints = 8;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const dist = baseRadius * (0.65 + Math.random() * 0.5);
        points.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist
        });
      }

      this.enemies.push({
        type: 'asteroid',
        x: spawnX,
        y: spawnY,
        vy: (2.6 + Math.random() * 1.8) * speedMultiplier, // Tăng thêm 40-50%
        radius: baseRadius,
        hp: baseRadius > 21 ? 2 : 1,
        color: '#f59e0b',
        polygon: points,
        angle: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: 0.02,
        points: baseRadius > 21 ? 20 : 10,
        hitFlash: 0
      });
    } else if (roll < asteroidRate + droneRate) {
      // 2. Bọ tím Neon: Bay zíc zắc nhanh và gắt (Tốc độ rơi tăng 35-50%)
      this.enemies.push({
        type: 'drone',
        x: spawnX,
        baseX: spawnX,
        y: spawnY,
        vy: (3.3 + Math.random() * 1.6) * speedMultiplier, // Tăng thêm 40-50%
        radius: 16,
        hp: 1,
        color: '#d946ef',
        phase: Math.random() * Math.PI * 2,
        amplitude: 38 + Math.random() * 26,
        points: 25,
        hitFlash: 0
      });
    } else {
      // 3. Tiêm kích đỏ: Lao nhanh săn đuổi (Tốc độ rơi tăng 35-50%)
      this.enemies.push({
        type: 'cruiser',
        x: spawnX,
        y: spawnY,
        vy: (1.9 + Math.random() * 0.9) * speedMultiplier, // Tăng thêm 40-50%
        radius: 23,
        hp: 4,
        color: '#ff0055',
        points: 60,
        hitFlash: 0
      });
    }
  }

  destroyEnemy(enemy, index, addPoints = true) {
    soundEngine.playExplosion();
    this.createExplosion(enemy.x, enemy.y, enemy.color, enemy.type === 'cruiser' ? 45 : 30);
    this.shake = 0;

    if (addPoints) {
      this.score += enemy.points;
      this.updateScore(this.score);

      this.floatingTexts.push({
        x: enemy.x,
        y: enemy.y,
        text: `+${enemy.points}`,
        color: enemy.color,
        life: 35
      });

      // Cân bằng vật phẩm: Giảm tỉ lệ rơi ngọc (Power-up) xuống một nửa (~9%, khi đông quái ~18%)
      const isCrowded = this.enemies.length >= 6;
      const dropChance = isCrowded ? 0.18 : (this.getLevel() >= 3 ? 0.12 : 0.09);

      if (Math.random() < dropChance) {
        this.spawnPowerUp(enemy.x, enemy.y);
      }
    }

    this.enemies.splice(index, 1);
  }

  spawnPowerUp(x, y) {
    const types = ['triple', 'mega', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerups.push({
      x,
      y,
      vy: 1.6,
      type,
      pulse: 0
    });
  }

  collectPowerUp(p) {
    soundEngine.playPowerUp();
    this.createExplosion(p.x, p.y, '#00f3ff', 20);

    if (p.type === 'triple') {
      this.player.weaponType = 'triple';
      this.player.weaponTimer = 60 * 10;
      this.floatingTexts.push({
        x: this.player.x,
        y: this.player.y - 30,
        text: '3 TIA LASER! [10s]',
        color: '#10b981',
        life: 50
      });
    } else if (p.type === 'mega') {
      this.player.weaponType = 'mega';
      this.player.weaponTimer = 60 * 8;
      this.floatingTexts.push({
        x: this.player.x,
        y: this.player.y - 30,
        text: 'MEGA BEAM! [8s]',
        color: '#ff0055',
        life: 50
      });
    } else if (p.type === 'shield') {
      this.player.shield = 1;
      this.floatingTexts.push({
        x: this.player.x,
        y: this.player.y - 30,
        text: 'KHIÊN BẢO VỆ!',
        color: '#00f3ff',
        life: 50
      });
    }
  }

  createExplosion(x, y, color, count = 30) {
    const colors = [color, '#d946ef', '#facc15', '#ff0055', '#00f3ff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 1.8;
      const sparkColor = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 1.5,
        color: sparkColor,
        life: Math.floor(Math.random() * 26) + 16,
        maxLife: 42,
        isSpark: Math.random() > 0.35
      });
    }
  }

  createHitSparks(x, y, color) {
    const colors = ['#ffffff', '#facc15', '#d946ef', '#ff0055'];
    for (let i = 0; i < 9; i++) {
      const angle = (Math.random() * Math.PI) + Math.PI / 2;
      const speed = Math.random() * 4.5 + 1.8;
      const sparkColor = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.2,
        color: sparkColor,
        life: 12,
        maxLife: 12,
        isSpark: true
      });
    }
  }

  handlePlayerDeath() {
    this.state = 'GAMEOVER';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    soundEngine.playExplosion();
    this.createExplosion(this.player.x, this.player.y, '#ff0055', 55);
    this.createExplosion(this.player.x, this.player.y, '#00f3ff', 45);

    this.draw();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('space_shooter_high_score', this.score.toString());
    }

    this.triggerGameOver(this.score);

    this.showGameOverOverlay({
      title: 'CHIẾN CƠ PHÁ HỦY!',
      score: this.score,
      highScore: this.highScore,
      subtitle: `Đạt Cấp Độ ${this.getLevel()} - Bạn đã chiến đấu oanh liệt giữa vũ trụ Neon!`
    });
  }

  // ================= RENDER VẼ CANVAS RETRO SYNTHWAVE =================

  draw() {
    const ctx = this.ctx;
    // Xóa sạch canvas trước mỗi frame, reset shadowBlur
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.save();

    // 1. Nền không gian tối sâu thẳm + Mây tinh vân tím sẫm (Purple Nebula Glow)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(0.5, '#070b1e');
    bgGrad.addColorStop(1, '#050816');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    const nebulaTopLeft = ctx.createRadialGradient(0, this.height * 0.25, 10, 0, this.height * 0.25, this.width * 0.85);
    nebulaTopLeft.addColorStop(0, 'rgba(147, 51, 234, 0.18)');
    nebulaTopLeft.addColorStop(0.5, 'rgba(88, 28, 135, 0.08)');
    nebulaTopLeft.addColorStop(1, 'transparent');
    ctx.fillStyle = nebulaTopLeft;
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    const nebulaBottomRight = ctx.createRadialGradient(this.width, this.height * 0.72, 10, this.width, this.height * 0.72, this.width * 0.85);
    nebulaBottomRight.addColorStop(0, 'rgba(217, 70, 239, 0.15)');
    nebulaBottomRight.addColorStop(0.5, 'rgba(236, 72, 153, 0.06)');
    nebulaBottomRight.addColorStop(1, 'transparent');
    ctx.fillStyle = nebulaBottomRight;
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    // 2. Vẽ dải sao Parallax 3 lớp - Tuyệt đối không bật shadowBlur
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    for (const star of this.stars) {
      if (star.isCross) {
        this.drawRetroCrossStar(ctx, star.x, star.y, star.size, star.color, star.alpha);
      } else {
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 3. Vẽ đạn laser (Lõi trắng sáng, viền neon, kéo dài vệt đuôi 12px)
    for (const laser of this.lasers) {
      this.drawLaser(ctx, laser);
    }

    // 4. Vẽ vật phẩm (Power-ups) - Tuyệt đối không bật shadowBlur để bảo vệ GPU
    for (const p of this.powerups) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const glowColor = p.type === 'triple' ? '#10b981' : (p.type === 'mega' ? '#ff0055' : '#00f3ff');
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2.2;
      ctx.fillStyle = 'rgba(7, 15, 30, 0.92)';

      const size = 15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = glowColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = p.type === 'triple' ? '3X' : (p.type === 'mega' ? 'M' : '🛡');
      ctx.fillText(label, p.x, p.y);
      ctx.restore();
    }

    // 5. Vẽ kẻ địch & thiên thạch (Khối cầu tròn 3D & tàu địch)
    for (const enemy of this.enemies) {
      this.drawEnemy(enemy);
    }

    // 6. Vẽ tàu người chơi (Khối đặc xanh navy bóng bẩy + Lửa phản lực kép)
    if (this.state === 'PLAYING') {
      const isFlashing = this.player.invulnerableTimer > 0 && Math.floor(this.gameTick / 4) % 2 === 0;
      if (!isFlashing) {
        this.drawPlayer();
      }
    }

    // 7. Vẽ chùm hạt nổ tia chớp (Sparks & Shards) - Tắt shadowBlur để chống tụt FPS
    for (const pt of this.particles) {
      const alpha = pt.life / pt.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      if (pt.isSpark) {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(1.2, pt.size * 0.75);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * 3.4, pt.y - pt.vy * 3.4);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Vẽ chữ nổi (Floating texts) - Tắt shadowBlur
    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, ft.life / 20);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 9. HUD trực quan
    this.drawHUD();

    ctx.restore();
  }

  drawRetroCrossStar(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    // Không dùng shadowBlur cho dải sao để tiết kiệm GPU & pin
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.moveTo(x, y - size * 2.2);
    ctx.quadraticCurveTo(x, y, x + size * 2.2, y);
    ctx.quadraticCurveTo(x, y, x, y + size * 2.2);
    ctx.quadraticCurveTo(x, y, x - size * 2.2, y);
    ctx.quadraticCurveTo(x, y, x, y - size * 2.2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Tia đạn: Lõi đạn màu trắng sáng (#ffffff) có viền neon, kéo dài vệt đuôi 12px để tạo tốc độ
   */
  drawLaser(ctx, laser) {
    ctx.save();
    ctx.shadowColor = laser.color;
    ctx.shadowBlur = laser.piercing ? 16 : 12;

    const len = laser.piercing ? 34 : 22;
    const tailLen = 12; // Kéo dài vệt đuôi 12px
    const rad = laser.radius;

    // 1. Vệt đuôi kéo dài 12px mờ dần
    const trailGrad = ctx.createLinearGradient(laser.x, laser.y - len * 0.5, laser.x, laser.y + len * 0.5 + tailLen);
    trailGrad.addColorStop(0, '#ffffff');
    trailGrad.addColorStop(0.3, laser.color);
    trailGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = trailGrad;

    ctx.beginPath();
    ctx.moveTo(laser.x, laser.y - len * 0.5); // Đầu nhọn
    ctx.lineTo(laser.x + rad, laser.y);
    ctx.lineTo(laser.x + rad * 0.4, laser.y + len * 0.5 + tailLen);
    ctx.lineTo(laser.x - rad * 0.4, laser.y + len * 0.5 + tailLen);
    ctx.lineTo(laser.x - rad, laser.y);
    ctx.closePath();
    ctx.fill();

    // 2. Lõi đạn màu trắng sáng (#ffffff) có viền neon sắc nét
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = laser.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(laser.x - rad * 0.6, laser.y - len * 0.35, rad * 1.2, len * 0.7, rad * 0.6);
    ctx.fill();
    ctx.stroke();

    // Reset shadowBlur ngay sau khi vẽ xong tia đạn
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.restore();
  }

  /**
   * Tàu người chơi: Khối đồ họa Arcade đặc sắc, bóng bẩy
   * - Thân tàu: Tô màu nền gradient chuyển từ xanh đen (#0b1d3a) sang xanh navy bóng bẩy, viền ngoài Neon Cyan (#00f3ff)
   * - Buồng lái: Khối giọt nước/tam giác màu trắng/cyan sáng chói ở trung tâm
   * - Đuôi tàu: 2 luồng lửa phản lực màu cam-vàng nhấp nháy ngẫu nhiên theo từng frame + thả tàn lửa phía sau
   * - Vòng khiên: Vòng tròn mờ có hiệu ứng quét xoay nhẹ quanh tàu
   */
  drawPlayer() {
    const ctx = this.ctx;
    const { x, y } = this.player;

    ctx.save();
    ctx.translate(x, y);

    // 1. Đuôi tàu: 2 luồng lửa phản lực (Jet Thrusters) màu cam-vàng nhấp nháy ngẫu nhiên theo từng frame
    [-11, 11].forEach(ox => {
      const flameH = 16 + Math.random() * 12; // Nhấp nháy ngẫu nhiên theo từng frame
      const flameW = 4.8 + Math.random() * 1.6;

      const outerFlame = ctx.createLinearGradient(ox, 18, ox, 18 + flameH);
      outerFlame.addColorStop(0, '#ffffff');
      outerFlame.addColorStop(0.25, '#facc15'); // Vàng
      outerFlame.addColorStop(0.65, '#ff5500'); // Cam
      outerFlame.addColorStop(1, 'transparent');
      ctx.fillStyle = outerFlame;
      ctx.beginPath();
      ctx.moveTo(ox - flameW, 18);
      ctx.lineTo(ox + flameW, 18);
      ctx.lineTo(ox, 18 + flameH);
      ctx.closePath();
      ctx.fill();

      // Lõi lửa trắng sáng chói
      const innerH = flameH * 0.5;
      const innerFlame = ctx.createLinearGradient(ox, 18, ox, 18 + innerH);
      innerFlame.addColorStop(0, '#ffffff');
      innerFlame.addColorStop(1, '#00f3ff');
      ctx.fillStyle = innerFlame;
      ctx.beginPath();
      ctx.moveTo(ox - 2, 18);
      ctx.lineTo(ox + 2, 18);
      ctx.lineTo(ox, 18 + innerH);
      ctx.closePath();
      ctx.fill();
    });

    // 2. Thân tàu: Tô màu nền gradient chuyển từ xanh đen (#0b1d3a) sang xanh navy bóng bẩy (#1e3a8a)
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2.2;

    const hullGrad = ctx.createLinearGradient(0, -28, 0, 22);
    hullGrad.addColorStop(0, '#0b1d3a'); // Xanh đen
    hullGrad.addColorStop(0.45, '#1e3a8a'); // Xanh navy bóng bẩy
    hullGrad.addColorStop(0.85, '#172554');
    hullGrad.addColorStop(1, '#0b1d3a');
    ctx.fillStyle = hullGrad;

    ctx.beginPath();
    ctx.moveTo(0, -28);       // Mũi tàu nhọn
    ctx.lineTo(10, -8);       // Thân trên phải
    ctx.lineTo(24, 12);       // Mút cánh phải
    ctx.lineTo(21, 18);       // Mép sau cánh phải
    ctx.lineTo(15, 17);       // Ụ động cơ phải
    ctx.lineTo(11, 20);       // Ống xả phản lực phải
    ctx.lineTo(6, 18);        // Vách ngăn động cơ
    ctx.lineTo(0, 22);        // Rãnh đuôi giữa
    ctx.lineTo(-6, 18);       // Vách ngăn động cơ
    ctx.lineTo(-11, 20);      // Ống xả phản lực trái
    ctx.lineTo(-15, 17);      // Ụ động cơ trái
    ctx.lineTo(-21, 18);      // Mép sau cánh trái
    ctx.lineTo(-24, 12);      // Mút cánh trái
    ctx.lineTo(-10, -8);      // Thân trên trái
    ctx.closePath();
    ctx.fill();   // Tô khối đặc bóng bẩy
    ctx.stroke(); // Viền nét Neon Cyan rực rỡ
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Mảng ốp giáp cánh phụ màu xanh đậm bóng bẩy
    ctx.fillStyle = '#0f2b5c';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 6;
    // Cánh phải
    ctx.beginPath();
    ctx.moveTo(9, -3);
    ctx.lineTo(19, 9);
    ctx.lineTo(13, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cánh trái
    ctx.beginPath();
    ctx.moveTo(-9, -3);
    ctx.lineTo(-19, 9);
    ctx.lineTo(-13, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 2 Ụ súng laser mút cánh
    [-23, 23].forEach(cx => {
      ctx.fillStyle = '#00f3ff';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 8;
      ctx.fillRect(cx - 1.5, 5, 3, 9);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    });

    // 3. Buồng lái (Cockpit): Khối giọt nước/tam giác nhỏ màu trắng/cyan sáng chói ở trung tâm
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14;
    const cockpitGrad = ctx.createLinearGradient(0, -18, 0, 4);
    cockpitGrad.addColorStop(0, '#ffffff'); // Trắng sáng chói
    cockpitGrad.addColorStop(0.35, '#cffafe');
    cockpitGrad.addColorStop(1, '#00f3ff'); // Neon cyan
    ctx.fillStyle = cockpitGrad;

    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(4.8, -4);
    ctx.lineTo(3.6, 6);
    ctx.lineTo(-3.6, 6);
    ctx.lineTo(-4.8, -4);
    ctx.closePath();
    ctx.fill();

    // Viền trắng sáng buồng lái
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 4. Vòng khiên: Vòng tròn mờ có hiệu ứng quét xoay nhẹ quanh tàu
    if (this.player.shield > 0) {
      const pulse = Math.sin(this.gameTick * 0.1) * 2;
      const r = 38 + pulse;

      // Vòng tròn mờ
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Hiệu ứng quét xoay nhẹ quanh tàu
      const sweepAngle = (this.gameTick * 0.06) % (Math.PI * 2);
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, sweepAngle, sweepAngle + Math.PI * 0.6);
      ctx.stroke();

      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r - 3, sweepAngle + Math.PI, sweepAngle + Math.PI * 1.4);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  /**
   * Kẻ địch & Thiên thạch:
   * - Thiên thạch: Khối Cầu Tròn (Radial 3D Asteroid):
   *   + Dùng ctx.arc() vẽ hình tròn, đổ bóng Radial Gradient (#5a3825 -> #24140a -> #0e0704)
   *   + 2-3 miệng hố va chạm (craters) viền cam dung nham
   *   + Tự xoay nhẹ (angle += 0.02) khi rơi
   *   + Viền ngoài hào quang neon cam, reset shadowBlur ngay
   * - Bọ tím Neon: Thân bọ ruột tím đậm, viền tím dạ quang, mắt đỏ rực
   * - Chiến hạm Alien: Thân đỏ đậm, lõi plasma xoay
   */
  drawEnemy(enemy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    const isFlashing = enemy.hitFlash > 0;

    if (enemy.type === 'asteroid') {
      const angle = enemy.angle !== undefined ? enemy.angle : (enemy.rotation || 0);
      ctx.rotate(angle);

      // Lưu ý: Không bật shadowBlur cho thiên thạch để tránh nóng máy
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      const poly = enemy.polygon;
      if (poly && poly.length >= 3) {
        // Vẽ khối đá đa giác:
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();

        if (isFlashing) {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Đổ ruột màu xám than tối:
          ctx.fillStyle = '#1c1917';
          ctx.fill();

          // Viền ngoài neon vàng cam:
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Vẽ 2-3 đường nứt sắc nhọn (Crack lines) bên trong thân đá thay vì vẽ hình tròn:
          ctx.beginPath();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1;
          ctx.moveTo(poly[1].x * 0.7, poly[1].y * 0.7);
          ctx.lineTo(0, 0);
          ctx.lineTo(poly[5].x * 0.6, poly[5].y * 0.6);
          if (poly[3]) {
            ctx.moveTo(0, 0);
            ctx.lineTo(poly[3].x * 0.55, poly[3].y * 0.55);
          }
          ctx.stroke();
        }
      }
    } else if (enemy.type === 'drone') {
      // Bọ tím Neon: Thân bọ tô ruột màu tím đậm (#2e0854), viền tím dạ quang (#f43f5e / #d946ef)
      if (isFlashing) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 18;
      } else {
        const bugGrad = ctx.createLinearGradient(0, -18, 0, 18);
        bugGrad.addColorStop(0, '#2e0854'); // Tím đậm
        bugGrad.addColorStop(0.5, '#3b0764');
        bugGrad.addColorStop(1, '#1e0538');
        ctx.fillStyle = bugGrad;
        ctx.strokeStyle = enemy.color; // Tím dạ quang
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 12;
      }
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(0, 18);          // Đầu nhọn cắm xuống
      ctx.lineTo(6, 6);           // Cổ
      ctx.lineTo(16, -6);         // Gai cánh phụ
      ctx.lineTo(20, -14);        // Đỉnh cánh dơi phải
      ctx.lineTo(12, -18);        // Mép cánh trong
      ctx.lineTo(5, -12);         // Lưng phải
      ctx.lineTo(0, -16);         // Đuôi giữa
      ctx.lineTo(-5, -12);        // Lưng trái
      ctx.lineTo(-12, -18);       // Mép cánh trong
      ctx.lineTo(-20, -14);       // Đỉnh cánh dơi trái
      ctx.lineTo(-16, -6);        // Gai cánh phụ
      ctx.lineTo(-6, 6);          // Cổ
      ctx.closePath();
      ctx.fill();   // Tô ruột tím đậm đặc
      ctx.stroke(); // Viền tím dạ quang
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      if (!isFlashing) {
        // Gân cánh dạ quang
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(6, 4);
        ctx.lineTo(14, -10);
        ctx.moveTo(-6, 4);
        ctx.lineTo(-14, -10);
        ctx.stroke();

        // 2 ĐIỂM SÁNG ĐỎ RỰC LÀM MẮT QUÁI
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff0055';

        [-4.5, 4.5].forEach(ex => {
          ctx.beginPath();
          ctx.ellipse(ex, 5, 2.5, 3.5, ex > 0 ? 0.3 : -0.3, 0, Math.PI * 2);
          ctx.fill();

          // Lõi trắng rực mắt quái
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex, 5, 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff0055';
        });
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }

    } else if (enemy.type === 'cruiser') {
      // 3. Phi thuyền địch (Alien Raider) mũi nhọn chúi thẳng xuống, 2 cánh dơi nhọn hoắt
      const buildRaiderPath = () => {
        ctx.beginPath();
        ctx.moveTo(0, 26);        // Mũi nhọn tiêm kích chúi thẳng xuống phía người chơi
        ctx.lineTo(9, 10);        // Thân trước phải
        ctx.lineTo(28, -2);       // Cánh phải nhọn hoắt vươn sang bên
        ctx.lineTo(24, -12);      // Mép sau cánh phải
        ctx.lineTo(14, -7);       // Rãnh hõm cánh trong
        ctx.lineTo(9, -18);       // Ụ động cơ phải
        ctx.lineTo(4, -18);       // Vách xả phải
        ctx.lineTo(0, -15);       // Khe đuôi giữa
        ctx.lineTo(-4, -18);      // Vách xả trái
        ctx.lineTo(-9, -18);      // Ụ động cơ trái
        ctx.lineTo(-14, -7);      // Rãnh hõm cánh trong
        ctx.lineTo(-24, -12);     // Mép sau cánh trái
        ctx.lineTo(-28, -2);      // Cánh trái nhọn hoắt vươn sang bên
        ctx.lineTo(-9, 10);       // Thân trước trái
        ctx.closePath();
      };

      if (isFlashing) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 18;
        buildRaiderPath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      } else {
        // a) Vệt lửa phản lực nhỏ màu đỏ ở phía sau (hướng lên trên)
        [-6, 6].forEach(exX => {
          const flameH = 8 + Math.random() * 7;
          const flameW = 2.4;
          const flameGrad = ctx.createLinearGradient(exX, -18, exX, -18 - flameH);
          flameGrad.addColorStop(0, '#ffffff'); // Lõi trắng sáng
          flameGrad.addColorStop(0.35, '#ff0055'); // Đỏ neon
          flameGrad.addColorStop(0.75, '#ff3300'); // Cam đỏ
          flameGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(exX - flameW, -18);
          ctx.lineTo(exX + flameW, -18);
          ctx.lineTo(exX, -18 - flameH);
          ctx.closePath();
          ctx.fill();
        });

        // b) Thân máy bay tô màu xám / tím đậm có viền đỏ neon (#ff0055)
        const raiderGrad = ctx.createLinearGradient(0, -18, 0, 26);
        raiderGrad.addColorStop(0, '#1c1022');  // Xám tím sẫm
        raiderGrad.addColorStop(0.45, '#28112b'); // Tím than kim loại
        raiderGrad.addColorStop(0.85, '#190a1e'); // Xám tím đậm
        raiderGrad.addColorStop(1, '#0e0412');
        ctx.fillStyle = raiderGrad;
        ctx.strokeStyle = '#ff0055'; // Viền đỏ neon
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.2;
        buildRaiderPath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // c) Hai cánh phát sáng nhọn hoắt ở 2 bên
        ctx.strokeStyle = '#ff2a70';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 9;
        ctx.beginPath();
        // Cánh phải
        ctx.moveTo(9, 8);
        ctx.lineTo(28, -2);
        ctx.lineTo(22, -10);
        // Cánh trái
        ctx.moveTo(-9, 8);
        ctx.lineTo(-28, -2);
        ctx.lineTo(-22, -10);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // d) Trung tâm buồng lái: Mắt quét laser hoặc đèn pha đỏ rực nhấp nháy
        const eyePulse = Math.sin(this.gameTick * 0.15) * 0.3 + 0.7;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 14 * eyePulse;
        ctx.fillStyle = '#ff0055';

        ctx.beginPath();
        ctx.moveTo(0, 16);  // Đầu nhọn mắt quét hướng xuống
        ctx.lineTo(4.5, 4);
        ctx.lineTo(0, -2);
        ctx.lineTo(-4.5, 4);
        ctx.closePath();
        ctx.fill();

        // Lõi đèn pha trắng sáng
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // e) Thanh máu nếu bị trúng đạn
        if (enemy.hp < 4) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(-16, -26, 32, 4);
          ctx.fillStyle = '#ff0055';
          ctx.fillRect(-16, -26, (enemy.hp / 4) * 32, 4);
        }
      }
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  drawHUD() {
    const ctx = this.ctx;
    ctx.save();
    // Tuyệt đối không bật shadowBlur cho HUD
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 1. Huy hiệu Cấp độ hiện tại (Level) - Cố định ở góc trên bên trái
    const level = this.getLevel();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 54, 26, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(`LV.${level}`, 37, 27);
    ctx.fillStyle = '#facc15';
    ctx.fillText(`LV.${level}`, 37, 27);

    // 2. Ô trạng thái Buff vũ khí góc trên bên trái (Ngay cạnh huy hiệu Level)
    if (this.player.weaponTimer > 0) {
      const remainingSec = (this.player.weaponTimer / 60).toFixed(1);
      const isMega = this.player.weaponType === 'mega';
      const borderColor = isMega ? '#ff0055' : '#00f3ff';
      const buffName = isMega ? 'MEGA LASER' : 'TRIPLE LASER';

      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(70, 10, 156, 26, 8);
      ctx.fill();
      ctx.stroke();

      // Chữ Trắng Sáng (#ffffff) có viền đen đậm sắc nét để không bao giờ bị chìm màu trên nền tối
      ctx.font = '900 10.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(buffName, 78, 27);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(buffName, 78, 27);

      // Số giây màu Vàng Neon (#facc15) nổi bật
      const timeStr = `${remainingSec}s`;
      ctx.textAlign = 'right';
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(timeStr, 218, 27);
      ctx.fillStyle = '#facc15';
      ctx.fillText(timeStr, 218, 27);
    }

    // 3. Ô trạng thái Khiên bảo vệ góc trên bên phải
    if (this.player.shield > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(this.width - 86, 10, 76, 26, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('🛡 KHIÊN', this.width - 48, 27);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🛡 KHIÊN', this.width - 48, 27);
    }

    ctx.restore();
  }

  drawStartScreen() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0b0f19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    const nebula = ctx.createRadialGradient(this.width * 0.5, this.height * 0.35, 10, this.width * 0.5, this.height * 0.35, this.width * 0.75);
    nebula.addColorStop(0, 'rgba(147, 51, 234, 0.22)');
    nebula.addColorStop(0.6, 'rgba(217, 70, 239, 0.08)');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const star of this.stars) {
      if (star.isCross) {
        this.drawRetroCrossStar(ctx, star.x, star.y, star.size, star.color, star.alpha);
      } else {
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Vẽ tàu mẫu khối đặc ở giữa
    this.player.x = this.width / 2;
    this.player.y = this.height * 0.44;
    this.drawPlayer();

    // Tiêu đề Cyberpunk Neon
    ctx.save();
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#00f3ff';
    ctx.font = '900 25px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHIẾN CƠ NEON', this.width / 2, this.height * 0.22);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#d946ef';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('SPACE SHOOTER RETRO SYNTHWAVE', this.width / 2, this.height * 0.27);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Kéo ngón tay hoặc di chuột để lái tàu', this.width / 2, this.height * 0.63);
    ctx.fillText('Đạn tự động bắn liên tục', this.width / 2, this.height * 0.68);

    const pulse = Math.sin(Date.now() * 0.006) * 0.2 + 0.8;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#00f3ff';
    ctx.font = '900 16px sans-serif';
    ctx.fillText('CHẠM ĐỂ XUẤT KÍCH ▶', this.width / 2, this.height * 0.78);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }

  destroy() {
    super.destroy();
    this.keys = {};
    this.isPointerDown = false;
    // Dọn dẹp triệt để bộ nhớ các mảng đối tượng
    this.stars = [];
    this.lasers = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    if (this.ctx) {
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
    }
  }
}
