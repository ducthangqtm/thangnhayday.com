class AdminPortal {
  constructor() {
    this.products = [];
    this.categories = ['Nhảy Dây', 'Tập Tại Nhà', 'Phụ Kiện'];
    this.editingId = null;

    this.githubConfig = {
      owner: 'ducthangqtm',
      repo: 'thangnhayday.com',
      branch: 'main',
      pat: ''
    };

    this.cacheKey = 'thang_admin_products_data';
    this.authStorageKey = 'thang_admin_github_pat';

    this.initDOM();
    this.initEvents();
    this.checkAuthStatus();
    this.loadInitialData();
  }

  initDOM() {
    this.authScreen = document.getElementById('adminAuthScreen');
    this.mainLayout = document.getElementById('adminMainLayout');
    this.loginForm = document.getElementById('loginForm');
    this.loginPatInput = document.getElementById('loginPatInput');
    this.toggleLoginPatBtn = document.getElementById('toggleLoginPatBtn');
    this.loginErrorAlert = document.getElementById('loginErrorAlert');
    this.logoutBtn = document.getElementById('logoutBtn');

    this.productForm = document.getElementById('productForm');
    this.formTitle = document.getElementById('formTitle');
    this.prodName = document.getElementById('prodName');
    this.prodCategory = document.getElementById('prodCategory');
    this.prodShopeeUrl = document.getElementById('prodShopeeUrl');
    this.prodTiktokUrl = document.getElementById('prodTiktokUrl');
    this.prodImageUrl = document.getElementById('prodImageUrl');
    this.imagePreview = document.getElementById('imagePreview');
    this.cancelEditBtn = document.getElementById('cancelEditBtn');
    this.saveProductBtn = document.getElementById('saveProductBtn');

    this.productList = document.getElementById('productList');
    this.totalProductsBadge = document.getElementById('totalProductsBadge');
    this.commitBtn = document.getElementById('commitBtn');
    this.downloadJsonBtn = document.getElementById('downloadJsonBtn');
    this.commitStatus = document.getElementById('commitStatus');

    this.categoryModal = document.getElementById('categoryModal');
    this.openCategoryMgrBtn = document.getElementById('openCategoryMgrBtn');
    this.closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
    this.addCategoryForm = document.getElementById('addCategoryForm');
    this.newCategoryInput = document.getElementById('newCategoryInput');
    this.categoryListContainer = document.getElementById('categoryListContainer');
  }

  initEvents() {
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const token = (this.loginPatInput.value || '').trim();
        if (token) {
          this.setToken(token);
          this.showMainLayout();
        }
      });
    }

    if (this.toggleLoginPatBtn) {
      this.toggleLoginPatBtn.addEventListener('click', () => {
        const isPwd = this.loginPatInput.type === 'password';
        this.loginPatInput.type = isPwd ? 'text' : 'password';
        this.toggleLoginPatBtn.textContent = isPwd ? '🔒' : '👁️';
      });
    }

    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    if (this.prodImageUrl) {
      this.prodImageUrl.addEventListener('input', () => {
        this.updateImagePreview(this.prodImageUrl.value.trim());
      });
    }

    if (this.productForm) {
      this.productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }

    if (this.cancelEditBtn) {
      this.cancelEditBtn.addEventListener('click', () => {
        this.resetForm();
      });
    }

    if (this.commitBtn) {
      this.commitBtn.addEventListener('click', () => {
        this.commitToGit(false);
      });
    }

    if (this.downloadJsonBtn) {
      this.downloadJsonBtn.addEventListener('click', () => {
        this.downloadJson();
      });
    }

    if (this.openCategoryMgrBtn) {
      this.openCategoryMgrBtn.addEventListener('click', () => {
        this.openCategoryModal();
      });
    }

    if (this.closeCategoryModalBtn) {
      this.closeCategoryModalBtn.addEventListener('click', () => {
        this.closeCategoryModal();
      });
    }

    if (this.addCategoryForm) {
      this.addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newCat = (this.newCategoryInput.value || '').trim();
        if (newCat) {
          this.addCategory(newCat);
          this.newCategoryInput.value = '';
        }
      });
    }
  }

  checkAuthStatus() {
    const saved = sessionStorage.getItem(this.authStorageKey) || localStorage.getItem(this.authStorageKey);
    if (saved) {
      this.githubConfig.pat = saved;
      this.showMainLayout();
    } else {
      this.showAuthScreen();
    }
  }

  setToken(token) {
    this.githubConfig.pat = token;
    sessionStorage.setItem(this.authStorageKey, token);
    localStorage.setItem(this.authStorageKey, token);
  }

  logout() {
    this.githubConfig.pat = '';
    sessionStorage.removeItem(this.authStorageKey);
    localStorage.removeItem(this.authStorageKey);
    this.showAuthScreen();
  }

  showAuthScreen() {
    if (this.authScreen) this.authScreen.classList.remove('hidden');
    if (this.mainLayout) this.mainLayout.classList.add('hidden');
  }

  showMainLayout() {
    if (this.authScreen) this.authScreen.classList.add('hidden');
    if (this.mainLayout) this.mainLayout.classList.remove('hidden');
  }

  async loadInitialData() {
    try {
      const res = await fetch('data/products.json?v=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.products) {
          this.products = data.products;
          this.categories = data.categories || this.categories;
        }
      }
    } catch (_) {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.products = parsed.products || [];
          this.categories = parsed.categories || this.categories;
        } catch (e) {}
      }
    }

    this.renderCategoryOptions();
    this.renderProducts();
  }

  persistLocal() {
    localStorage.setItem(this.cacheKey, JSON.stringify({
      categories: this.categories,
      products: this.products
    }));
  }

  renderCategoryOptions() {
    if (!this.prodCategory) return;
    this.prodCategory.innerHTML = this.categories.map(cat => `
      <option value="${this.escapeHTML(cat)}">${this.escapeHTML(cat)}</option>
    `).join('');
  }

  updateImagePreview(url) {
    if (!this.imagePreview) return;
    if (url) {
      this.imagePreview.src = url;
      this.imagePreview.classList.remove('hidden');
      this.imagePreview.onerror = () => {
        this.imagePreview.classList.add('hidden');
      };
    } else {
      this.imagePreview.classList.add('hidden');
    }
  }

  saveProduct() {
    const name = (this.prodName.value || '').trim();
    const category = (this.prodCategory.value || '').trim();
    const shopeeUrl = (this.prodShopeeUrl.value || '').trim();
    const tiktokUrl = (this.prodTiktokUrl.value || '').trim();
    const imageUrl = (this.prodImageUrl.value || '').trim();

    if (!name || !imageUrl) {
      alert('Vui lòng nhập Tên sản phẩm và Link ảnh!');
      return;
    }

    if (this.editingId) {
      const prod = this.products.find(p => p.id === this.editingId);
      if (prod) {
        prod.name = name;
        prod.category = category;
        prod.shopeeUrl = shopeeUrl;
        prod.affiliate_url = shopeeUrl;
        prod.tiktokUrl = tiktokUrl;
        prod.image_url = imageUrl;
      }
    } else {
      const newProd = {
        id: 'prod-' + Date.now(),
        name,
        category,
        shopeeUrl,
        affiliate_url: shopeeUrl,
        tiktokUrl,
        image_url: imageUrl,
        price: 'Giá tốt',
        order: this.products.length + 1
      };
      this.products.push(newProd);
    }

    this.persistLocal();
    this.renderProducts();
    this.resetForm();
  }

  editProduct(id) {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;

    this.editingId = id;
    this.formTitle.innerHTML = '<span>✏️</span><span>Chỉnh Sửa Sản Phẩm</span>';
    this.saveProductBtn.innerText = 'CẬP NHẬT';
    this.cancelEditBtn.classList.remove('hidden');

    this.prodName.value = prod.name || '';
    this.prodCategory.value = prod.category || this.categories[0];
    this.prodShopeeUrl.value = prod.shopeeUrl || prod.affiliate_url || '';
    this.prodTiktokUrl.value = prod.tiktokUrl || '';
    this.prodImageUrl.value = prod.image_url || '';
    this.updateImagePreview(prod.image_url || '');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteProduct(id) {
    const prod = this.products.find(p => p.id === id);
    if (!prod) return;
    if (confirm(`Bạn có chắc muốn xóa sản phẩm "${prod.name}" không?`)) {
      this.products = this.products.filter(p => p.id !== id);
      this.persistLocal();
      this.renderProducts();
      if (this.editingId === id) this.resetForm();
    }
  }

  moveProduct(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.products.length) return;

    const temp = this.products[index];
    this.products[index] = this.products[newIndex];
    this.products[newIndex] = temp;

    this.products.forEach((p, idx) => {
      p.order = idx + 1;
    });

    this.persistLocal();
    this.renderProducts();
  }

  resetForm() {
    this.editingId = null;
    this.formTitle.innerHTML = '<span>➕</span><span>Thêm Sản Phẩm Mới</span>';
    this.saveProductBtn.innerText = 'LƯU SẢN PHẨM';
    this.cancelEditBtn.classList.add('hidden');
    this.productForm.reset();
    this.updateImagePreview('');
  }

  renderProducts() {
    if (!this.productList) return;
    if (this.totalProductsBadge) {
      this.totalProductsBadge.textContent = `${this.products.length} sản phẩm`;
    }

    if (this.products.length === 0) {
      this.productList.innerHTML = `
        <div class="p-8 text-center text-slate-500 text-xs">
          Chưa có sản phẩm nào. Hãy thêm sản phẩm ở form bên trái!
        </div>
      `;
      return;
    }

    this.productList.innerHTML = this.products.map((p, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === this.products.length - 1;

      return `
        <div class="product-item-row">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <span class="text-xs font-mono font-bold text-slate-500 w-5 text-center flex-shrink-0">
              #${idx + 1}
            </span>
            <img src="${this.escapeHTML(p.image_url)}" alt="${this.escapeHTML(p.name)}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-950 border border-slate-700" onerror="this.src='assets/logo-tit.svg'" />
            <div class="min-w-0 flex-1">
              <span class="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                ${this.escapeHTML(p.category || '')}
              </span>
              <h4 class="text-xs font-bold text-white truncate" title="${this.escapeHTML(p.name)}">
                ${this.escapeHTML(p.name)}
              </h4>
              <div class="flex items-center gap-2 mt-0.5 text-[11px]">
                ${p.shopeeUrl ? `<a href="${this.escapeHTML(p.shopeeUrl)}" target="_blank" class="text-amber-400 hover:underline">Shopee ↗</a>` : ''}
                ${p.tiktokUrl ? `<a href="${this.escapeHTML(p.tiktokUrl)}" target="_blank" class="text-cyan-300 hover:underline">TikTok ↗</a>` : ''}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button class="move-up-btn p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-cyan-400 transition" data-index="${idx}" ${isFirst ? 'disabled style="opacity:0.2;"' : ''} title="Đẩy lên">⬆️</button>
            <button class="move-down-btn p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-cyan-400 transition" data-index="${idx}" ${isLast ? 'disabled style="opacity:0.2;"' : ''} title="Đẩy xuống">⬇️</button>
            <button class="edit-btn p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-cyan-400 transition" data-id="${p.id}" title="Sửa">✏️</button>
            <button class="del-btn p-1.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-xs text-rose-400 transition" data-id="${p.id}" title="Xóa">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    this.productList.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.moveProduct(parseInt(btn.dataset.index, 10), -1);
      });
    });

    this.productList.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.moveProduct(parseInt(btn.dataset.index, 10), 1);
      });
    });

    this.productList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editProduct(btn.dataset.id);
      });
    });

    this.productList.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteProduct(btn.dataset.id);
      });
    });
  }

  openCategoryModal() {
    if (!this.categoryModal) return;
    this.renderCategoryList();
    this.categoryModal.classList.remove('hidden');
    this.categoryModal.classList.add('flex');
  }

  closeCategoryModal() {
    if (!this.categoryModal) return;
    this.categoryModal.classList.add('hidden');
    this.categoryModal.classList.remove('flex');
  }

  addCategory(name) {
    if (!this.categories.includes(name)) {
      this.categories.push(name);
      this.persistLocal();
      this.renderCategoryOptions();
      this.renderCategoryList();
    }
  }

  deleteCategory(name) {
    if (this.categories.length <= 1) {
      alert('Phải giữ lại ít nhất 1 danh mục!');
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa danh mục "${name}"?`)) {
      this.categories = this.categories.filter(c => c !== name);
      this.persistLocal();
      this.renderCategoryOptions();
      this.renderCategoryList();
      this.renderProducts();
    }
  }

  renderCategoryList() {
    if (!this.categoryListContainer) return;
    this.categoryListContainer.innerHTML = this.categories.map(cat => `
      <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
        <span class="font-bold text-white">${this.escapeHTML(cat)}</span>
        <button class="del-cat-btn text-rose-400 hover:text-rose-300 font-bold px-2 py-0.5 rounded bg-rose-500/10" data-cat="${this.escapeHTML(cat)}">Xóa</button>
      </div>
    `).join('');

    this.categoryListContainer.querySelectorAll('.del-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteCategory(btn.dataset.cat);
      });
    });
  }

  downloadJson() {
    const payload = {
      categories: this.categories,
      products: this.products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async commitToGit(isAuto = false) {
    const rawToken = (this.githubConfig.pat || '').trim();
    const cleanToken = rawToken.replace(/^(Bearer|token)\s+/i, '').trim();

    if (!cleanToken) {
      alert('Vui lòng đăng nhập với GitHub Personal Access Token (PAT) để đồng bộ!');
      this.showAuthScreen();
      return;
    }

    const owner = this.githubConfig.owner;
    const repo = this.githubConfig.repo;
    const branch = this.githubConfig.branch;
    const filePath = 'data/products.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    if (this.commitBtn) {
      this.commitBtn.disabled = true;
      this.commitBtn.innerText = 'Đang đồng bộ lên GitHub...';
    }
    if (this.commitStatus) {
      this.commitStatus.innerHTML = `<span class="text-cyan-400 text-xs animate-pulse">Đang liên hệ GitHub API...</span>`;
    }

    try {
      let latestSha = null;
      const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}&_t=${Date.now()}`, {
        headers: {
          'Authorization': `token ${cleanToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.ok) {
        const fileData = await getRes.json();
        latestSha = fileData.sha;
      }

      const payload = {
        categories: this.categories,
        products: this.products
      };
      const jsonString = JSON.stringify(payload, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${cleanToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: 'Update affiliate products via Admin Portal',
          content: base64Content,
          branch: branch,
          ...(latestSha ? { sha: latestSha } : {})
        })
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(err.message || `Lỗi HTTP ${putRes.status}`);
      }

      if (this.commitStatus) {
        this.commitStatus.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
            <span>🚀</span>
            <span>Đã đồng bộ lên GitHub thành công! Web sẽ tự động cập nhật.</span>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      if (this.commitStatus) {
        this.commitStatus.innerHTML = `
          <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>Lỗi: ${this.escapeHTML(err.message)}</span>
          </div>
        `;
      }
    } finally {
      if (this.commitBtn) {
        this.commitBtn.disabled = false;
        this.commitBtn.innerText = '🚀 CẬP NHẬT LÊN GITHUB';
      }
    }
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
