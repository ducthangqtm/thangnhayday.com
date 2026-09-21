/**
 * GameCarousel: Quản lý Game Carousel Trượt Vòng Tròn (True Seamless Infinite Carousel)
 * Cấu trúc 10 slide:
 * [Clone 5, Clone 6] + [Game 1, 2, 3, 4, 5, 6] + [Clone 1, Clone 2]
 *
 * Chỉ số index:
 * 0: Clone 5 (2048)
 * 1: Clone 6 (Tetris)
 * 2: Game 1 (Thắng Nhảy Dây) - REAL 1 (Mặc định)
 * 3: Game 2 (Chiến Cơ Neon) - REAL 2
 * 4: Game 3 (Đua Xe Neon) - REAL 3
 * 5: Game 4 (Cyber Snake) - REAL 4
 * 6: Game 5 (2048 Neon) - REAL 5
 * 7: Game 6 (Xếp Hình Neon) - REAL 6
 * 8: Clone 1 (Thắng Nhảy Dây)
 * 9: Clone 2 (Chiến Cơ Neon)
 */
export class GameCarousel {
  constructor(containerElement, { prevBtn, nextBtn, dotsContainer, onActiveGameChange, onLaunchGame } = {}) {
    this.container = containerElement;
    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
    this.dotsContainer = dotsContainer;
    this.onActiveGameChange = onActiveGameChange;
    this.onLaunchGame = onLaunchGame;

    this.activeGameId = 'jump';
    this.allCards = [];
    this.dots = [];
    this.isTeleporting = false;
    this.isProgrammaticScrolling = false;
    this.isUserTouching = false;
    this.scrollDebounceTimer = null;

    // Kéo chuột trên PC
    this.isMouseDown = false;
    this.hasMoved = false;
    this.mouseStartX = 0;
    this.mouseScrollLeft = 0;

    // Mapping gameId -> Real index (2..7)
    this.realIndexMap = {
      jump: 2,
      space_shooter: 3,
      racer: 4,
      snake: 5,
      '2048': 6,
      tetris: 7
    };

    // Mapping card index -> gameId
    this.indexGameMap = {
      0: '2048',
      1: 'tetris',
      2: 'jump',
      3: 'space_shooter',
      4: 'racer',
      5: 'snake',
      6: '2048',
      7: 'tetris',
      8: 'jump',
      9: 'space_shooter'
    };

    this.init();
  }

  init() {
    if (!this.container) return;

    this.allCards = Array.from(this.container.querySelectorAll('.game-card'));
    if (this.dotsContainer) {
      this.dots = Array.from(this.dotsContainer.querySelectorAll('.carousel-dot'));
    }

    this.initScrollHandlers();
    this.initNavButtons();
    this.initDots();
    this.initCardClicks();
    this.initMouseDrag();

    // Mặc định ban đầu định vị ngay thẻ Thắng Nhảy Dây (index 2) ở giữa
    setTimeout(() => {
      this.resetToDefault(false);
    }, 50);

    window.addEventListener('resize', () => {
      if (this.isTeleporting) return;
      const realIdx = this.realIndexMap[this.activeGameId] || 2;
      this.centerCardInstant(realIdx);
    });
  }

  getCenterScrollLeft(card) {
    if (!this.container || !card) return 0;
    const containerWidth = this.container.clientWidth;
    const cardLeft = card.offsetLeft;
    const cardWidth = card.offsetWidth;
    return cardLeft - (containerWidth / 2) + (cardWidth / 2);
  }

  /**
   * Cuộn mượt đến thẻ chỉ định kèm callback khi cuộn kết thúc
   */
  centerCardSmooth(index, callback = null) {
    const card = this.allCards[index];
    if (!card || !this.container) return;

    this.isProgrammaticScrolling = true;
    const target = this.getCenterScrollLeft(card);

    this.container.style.scrollBehavior = 'smooth';
    this.container.scrollTo({
      left: target,
      behavior: 'smooth'
    });

    let finished = false;
    const onDone = () => {
      if (finished) return;
      finished = true;
      this.isProgrammaticScrolling = false;
      if (callback) {
        callback();
      } else {
        this.handleScrollSettled();
      }
    };

    // Lắng nghe sự kiện scrollend chuẩn
    const onScrollEnd = () => {
      this.container.removeEventListener('scrollend', onScrollEnd);
      onDone();
    };
    this.container.addEventListener('scrollend', onScrollEnd, { once: true });

    // Fallback timer (320ms) an toàn cho trình duyệt chưa hoàn thiện scrollend
    setTimeout(() => {
      this.container.removeEventListener('scrollend', onScrollEnd);
      onDone();
    }, 320);
  }

  centerCardInstant(index) {
    const card = this.allCards[index];
    if (!card || !this.container) return;
    const target = this.getCenterScrollLeft(card);
    this.container.style.scrollBehavior = 'auto';
    this.container.style.scrollSnapType = 'none';
    this.container.scrollLeft = target;
    requestAnimationFrame(() => {
      void this.container.offsetWidth;
      this.container.style.scrollSnapType = 'x mandatory';
    });
  }

  getClosestCenterIndex() {
    if (!this.container || this.allCards.length === 0) return 2;
    const containerRect = this.container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let minDiff = Infinity;
    let closestIdx = 2;

    this.allCards.forEach((card, idx) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const diff = Math.abs(cardCenter - containerCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    return closestIdx;
  }

  /**
   * Khởi tạo lắng nghe thanh cuộn (Debounce 250ms & scrollend)
   * Tuyệt đối không gọi API nạp bảng điểm trong khi ngón tay đang trượt!
   */
  initScrollHandlers() {
    // Khi đang trượt: Cập nhật visual chấm tròn & viền active, KHÔNG gọi API
    const onScroll = () => {
      if (this.isTeleporting) return;

      const closestIdx = this.getClosestCenterIndex();
      // Map preview gameId về game thật
      let previewGameId = 'jump';
      if (closestIdx >= 8) {
        previewGameId = this.indexGameMap[closestIdx - 6];
      } else if (closestIdx <= 1) {
        previewGameId = this.indexGameMap[closestIdx + 6];
      } else {
        previewGameId = this.indexGameMap[closestIdx] || 'jump';
      }

      this.updateDotsUI(previewGameId);
      this.updateCardsVisual(closestIdx);

      // Nếu đang chạy cuộn qua nút bấm programmatic thì để programmatic callback xử lý
      if (this.isProgrammaticScrolling) return;

      // Debounce 250ms: Chờ thanh cuộn DỪNG HẲN mới xử lý snap & nạp Bảng Vàng
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = setTimeout(() => {
        if (!this.isUserTouching && !this.isMouseDown) {
          this.handleScrollSettled();
        }
      }, 250);
    };

    this.container.addEventListener('scroll', onScroll, { passive: true });

    // Sự kiện scrollend chuẩn
    this.container.addEventListener('scrollend', () => {
      if (this.isTeleporting || this.isProgrammaticScrolling) return;
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = setTimeout(() => {
        if (!this.isUserTouching && !this.isMouseDown) {
          this.handleScrollSettled();
        }
      }, 60);
    });

    // Theo dõi trạng thái chạm cảm ứng
    this.container.addEventListener('touchstart', () => {
      this.isUserTouching = true;
    }, { passive: true });

    const onTouchEnd = () => {
      this.isUserTouching = false;
      if (this.isTeleporting || this.isProgrammaticScrolling) return;
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = setTimeout(() => {
        this.handleScrollSettled();
      }, 250);
    };

    this.container.addEventListener('touchend', onTouchEnd, { passive: true });
    this.container.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  /**
   * Xử lý khi thanh cuộn đã DỪNG HẲN (Settled)
   * Kiểm tra nếu đang dừng ở thẻ Clone thì Teleport ngầm về thẻ Thật
   */
  handleScrollSettled() {
    if (this.isTeleporting) return;

    const closestIdx = this.getClosestCenterIndex();

    // 1. Dừng ở Thẻ Clone bên phải (Index 8 hoặc 9)
    // -> Teleport tức thì về Thẻ Thật tương ứng (Index - 6)
    if (closestIdx >= 8) {
      const realIdx = closestIdx - 6; // 8 -> 2 (Jump), 9 -> 3 (Space Shooter)
      const gameId = this.indexGameMap[realIdx];
      this.teleportTo(realIdx, gameId);
      return;
    }

    // 2. Dừng ở Thẻ Clone bên trái (Index 0 hoặc 1)
    // -> Teleport tức thì về Thẻ Thật tương ứng (Index + 6)
    if (closestIdx <= 1) {
      const realIdx = closestIdx + 6; // 1 -> 7 (Tetris), 0 -> 6 (2048)
      const gameId = this.indexGameMap[realIdx];
      this.teleportTo(realIdx, gameId);
      return;
    }

    // 3. Đang dừng ở khoảng thẻ thật 2..7
    const realCard = this.allCards[closestIdx];
    if (realCard) {
      const gameId = realCard.dataset.gameId || this.indexGameMap[closestIdx] || 'jump';
      this.setActiveGame(gameId, realCard, true);
    }
  }

  /**
   * Quy trình chuyển mượt tuyệt đối (Seamless Teleport):
   * 1. Tạm thời tắt snap và smooth:
   *    container.style.scrollSnapType = 'none';
   *    container.style.scrollBehavior = 'auto';
   * 2. Dịch chuyển tọa độ tàng hình về đúng Game thật:
   *    container.scrollLeft = vị_trí_Game_thật;
   * 3. Dùng requestAnimationFrame bật lại snap:
   *    requestAnimationFrame(() => { container.style.scrollSnapType = 'x mandatory'; });
   */
  teleportTo(targetIndex, gameId) {
    this.isTeleporting = true;

    // 1. Tạm thời tắt snap và smooth
    this.container.style.scrollSnapType = 'none';
    this.container.style.scrollBehavior = 'auto';

    // 2. Dịch chuyển tọa độ tàng hình về đúng Game thật
    const realCard = this.allCards[targetIndex];
    if (realCard) {
      const targetScrollLeft = this.getCenterScrollLeft(realCard);
      this.container.scrollLeft = targetScrollLeft;
    }

    // Cập nhật trạng thái active card & dots
    this.setActiveGame(gameId, realCard, true);

    // 3. Dùng requestAnimationFrame bật lại snap
    requestAnimationFrame(() => {
      // Force reflow
      void this.container.offsetWidth;
      this.container.style.scrollSnapType = 'x mandatory';
      setTimeout(() => {
        this.isTeleporting = false;
      }, 50);
    });
  }

  updateCardsVisual(activeIdx) {
    this.allCards.forEach((card, idx) => {
      if (idx === activeIdx) {
        card.classList.add('active-game-card');
      } else {
        card.classList.remove('active-game-card');
      }
    });
  }

  updateDotsUI(activeGameId) {
    if (!this.dots || this.dots.length === 0) return;
    this.dots.forEach((dot) => {
      if (dot.dataset.gameId === activeGameId) {
        dot.classList.add('bg-cyan-400', 'w-6');
        dot.classList.remove('bg-slate-700', 'w-2');
      } else {
        dot.classList.remove('bg-cyan-400', 'w-6');
        dot.classList.add('bg-slate-700', 'w-2');
      }
    });
  }

  setActiveGame(gameId, cardElement, notify = false) {
    const isNewGame = this.activeGameId !== gameId;
    this.activeGameId = gameId;

    this.allCards.forEach((card) => {
      if (card === cardElement || (!cardElement && card.dataset.gameId === gameId && !card.dataset.isClone)) {
        card.classList.add('active-game-card');
      } else {
        card.classList.remove('active-game-card');
      }
    });

    this.updateDotsUI(gameId);

    // Kích hoạt đồng bộ Bảng Xếp Hạng khi dừng hẳn (notify = true)
    if (notify && this.onActiveGameChange) {
      this.onActiveGameChange(gameId);
    }
  }

  /**
   * Điều khiển nút bấm [<] và [>]:
   * - Khi ở Game 6 (index 7) bấm [>]: Trượt mượt sang Clone 1 (index 8), sau đó nhảy ngầm về Game 1 thật (index 2).
   * - Khi ở Game 1 (index 2) bấm [<]: Trượt mượt sang Clone 6 (index 1), sau đó nhảy ngầm về Game 6 thật (index 7).
   */
  initNavButtons() {
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        if (this.isTeleporting || this.isProgrammaticScrolling) return;
        const curr = this.getClosestCenterIndex();

        // Đang ở Game 1 thật (index 2) -> Trượt mượt sang Clone 6 (index 1), rồi teleport ngầm về Game 6 thật (index 7)
        if (curr === 2) {
          this.centerCardSmooth(1, () => {
            this.teleportTo(7, 'tetris');
          });
        } else {
          this.centerCardSmooth(curr - 1);
        }
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        if (this.isTeleporting || this.isProgrammaticScrolling) return;
        const curr = this.getClosestCenterIndex();

        // Đang ở Game 6 thật (index 7) -> Trượt mượt sang Clone 1 (index 8), rồi teleport ngầm về Game 1 thật (index 2)
        if (curr === 7) {
          this.centerCardSmooth(8, () => {
            this.teleportTo(2, 'jump');
          });
        } else {
          this.centerCardSmooth(curr + 1);
        }
      });
    }
  }

  initDots() {
    if (!this.dots || this.dots.length === 0) return;

    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const gameId = dot.dataset.gameId;
        if (!gameId) return;
        this.scrollToGame(gameId);
      });
    });
  }

  scrollToGame(gameId) {
    if (this.isTeleporting || this.isProgrammaticScrolling) return;
    const currIdx = this.getClosestCenterIndex();
    const targetRealIdx = this.realIndexMap[gameId] || 2;

    // Vòng lặp mượt mà khi đổi giữa 2 đầu danh sách qua dots
    if (currIdx === 7 && gameId === 'jump') {
      this.centerCardSmooth(8, () => {
        this.teleportTo(2, 'jump');
      });
      return;
    }
    if (currIdx === 2 && gameId === 'tetris') {
      this.centerCardSmooth(1, () => {
        this.teleportTo(7, 'tetris');
      });
      return;
    }

    this.centerCardSmooth(targetRealIdx);
  }

  initCardClicks() {
    this.allCards.forEach((card, idx) => {
      card.addEventListener('click', (e) => {
        if (this.hasMoved) return;

        const gameId = card.dataset.gameId;
        if (!gameId) return;

        // 1. Nhấn nút [Chơi Ngay ▶]
        if (e.target.closest('.launch-game-btn')) {
          e.stopPropagation();
          this.setActiveGame(gameId, card, false);
          if (this.onLaunchGame) {
            this.onLaunchGame(gameId);
          }
          return;
        }

        // 2. Chạm vào thẻ đang active ở giữa -> Mở game chơi luôn
        const closestIdx = this.getClosestCenterIndex();
        if (idx === closestIdx && this.activeGameId === gameId) {
          if (this.onLaunchGame) {
            this.onLaunchGame(gameId);
          }
          return;
        }

        // 3. Chạm vào thẻ bên cạnh -> Cuộn thẻ đó vào giữa mượt mà
        this.centerCardSmooth(idx);
      });
    });
  }

  initMouseDrag() {
    const el = this.container;
    if (!el) return;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.launch-game-btn') || this.isTeleporting) return;
      this.isMouseDown = true;
      this.hasMoved = false;
      el.classList.add('cursor-grabbing');
      this.mouseStartX = e.pageX - el.offsetLeft;
      this.mouseScrollLeft = el.scrollLeft;
    });

    const endDrag = () => {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;
      el.classList.remove('cursor-grabbing');
      setTimeout(() => this.handleScrollSettled(), 70);
    };

    el.addEventListener('mouseleave', endDrag);
    el.addEventListener('mouseup', endDrag);

    el.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - this.mouseStartX) * 1.35;
      if (Math.abs(walk) > 5) {
        this.hasMoved = true;
      }
      el.scrollLeft = this.mouseScrollLeft - walk;
    });
  }

  /**
   * Reset vị trí cuộn về đúng thẻ thật [Game 1: Thắng Nhảy Dây] (index 2)
   */
  resetToDefault(notify = true) {
    if (!this.container || this.allCards.length < 8) return;

    this.isTeleporting = true;
    this.container.style.scrollSnapType = 'none';
    this.container.style.scrollBehavior = 'auto';

    const jumpCard = this.allCards[2];
    if (jumpCard) {
      const target = this.getCenterScrollLeft(jumpCard);
      this.container.scrollLeft = target;
    }

    this.setActiveGame('jump', jumpCard, notify);

    requestAnimationFrame(() => {
      void this.container.offsetWidth;
      this.container.style.scrollSnapType = 'x mandatory';
      setTimeout(() => {
        this.isTeleporting = false;
      }, 60);
    });
  }
}
