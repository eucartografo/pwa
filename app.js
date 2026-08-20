// ══════════════════════════════════════════════════════════
//  APP PRINCIPAL — autenticação, navegação, ciclo de vida
// ══════════════════════════════════════════════════════════

const App = (() => {

  let _currentPage = 'painel';
  let _token = null;
  let _tokenClient = null;
  let _tokenExpiry = 0;
  let _userPayload = null;
  let _navHistory = ['painel'];   // histórico de páginas visitadas
  let _exitPending = false;       // aguardando confirmação de saída
  let _perfilOpen = false;        // menu de perfil aberto
  let _exiting = false;           // saindo de fato (evita reabrir o modal)

  const STORAGE_KEY = 'familia_user';

  const PAGE_TITLES = {
    painel: 'Painel', saude: 'Saúde Financeira', contas: 'Contas',
    receitas: 'Receitas', despesas: 'Despesas', orcamento: 'Orçamento',
    cartao: 'Cartão', dividas: 'Dívidas', metas: 'Metas', relatorio: 'Relatório Mensal',
  };

  const PAGE_RENDERERS = {
    painel:    Pages.renderPainel,
    saude:     Pages.renderSaude,
    contas:    Pages.renderContas,
    receitas:  Pages.renderReceitas,
    despesas:  Pages.renderDespesas,
    orcamento: Pages.renderOrcamento,
    cartao:    Pages.renderCartao,
    dividas:   Pages.renderDividas,
    metas:     Pages.renderMetas,
    relatorio: Pages.renderRelatorio,
  };

  // ── Navegação com histórico ───────────────────────────
  function navigateTo(page) {
    if (page === _currentPage) return;

    // Empurra estado no histórico do browser (para o botão voltar Android funcionar)
    history.pushState({ page }, '', '#' + page);

    // Atualiza o histórico interno
    _navHistory.push(page);

    _applyPage(page);
  }

  function _applyPage(page) {
    document.querySelectorAll('.nav-item, .bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
    _currentPage = page;
    loadPage(page);
  }

  async function loadPage(page) {
    if (_token && Date.now() > _tokenExpiry - 5 * 60 * 1000) {
      await refreshTokenSilent();
    }
    const el = document.getElementById(`page-${page}`);
    const renderer = PAGE_RENDERERS[page];
    if (renderer) renderer(el);
  }

  // ── Botão voltar Android ──────────────────────────────
  function initBackButton() {
    // Estado inicial no histórico do browser
    history.replaceState({ page: 'painel' }, '', '#painel');
    // Empurra uma entrada "coxim" extra: sem ela, na raiz não existe
    // nenhuma entrada anterior no histórico da página para o popstate
    // disparar, e o Android fecha o app direto sem mostrar o modal.
    history.pushState({ page: 'painel' }, '', '#painel');

    window.addEventListener('popstate', (e) => {
      // Se estamos de fato saindo (confirmExit em modo navegador),
      // deixa o navegador seguir em vez de reinterceptar o back.
      if (_exiting) return;

      // Se o menu de perfil estiver aberto, fecha ele primeiro
      if (_perfilOpen) {
        togglePerfilMenu();
        // Reempurra estado para manter o histórico correto
        history.pushState({ page: _currentPage }, '', '#' + _currentPage);
        return;
      }

      // Se um modal estiver aberto, fecha ele
      const modalOpen = document.getElementById('modal-overlay')?.classList.contains('open');
      if (modalOpen) {
        Pages.closeModal();
        history.pushState({ page: _currentPage }, '', '#' + _currentPage);
        return;
      }

      // Se não estiver na tela de login e tiver histórico, volta para página anterior
      const appVisible = document.getElementById('screen-app')?.classList.contains('active');
      if (!appVisible) return;

      if (_navHistory.length > 1) {
        _navHistory.pop(); // remove página atual
        const anterior = _navHistory[_navHistory.length - 1];
        _applyPage(anterior);
      } else {
        // Está na raiz (Painel) — mostra confirmação de saída
        history.pushState({ page: 'painel' }, '', '#painel'); // reempurra para não sair
        showExitModal();
      }
    });
  }

  // ── Modal de confirmação de saída ────────────────────
  function showExitModal() {
    _exitPending = true;
    document.getElementById('exit-modal').style.display = 'flex';
  }

  function cancelExit() {
    _exitPending = false;
    document.getElementById('exit-modal').style.display = 'none';
  }

  function confirmExit() {
    _exitPending = false;
    document.getElementById('exit-modal').style.display = 'none';
    // Em PWA standalone, fecha o app
    if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
      window.close();
    } else {
      // No navegador, sai do histórico do app (marca _exiting para o
      // listener de popstate não reinterceptar e reabrir o modal)
      _exiting = true;
      history.back();
    }
  }

  // ── Menu de perfil (mobile) ───────────────────────────
  function togglePerfilMenu() {
    _perfilOpen = !_perfilOpen;
    document.getElementById('perfil-menu').style.display = _perfilOpen ? 'flex' : 'none';
  }

  function updatePerfilMenu(name, email, picture) {
    const el = document.getElementById('perfil-menu-nome');
    const em = document.getElementById('perfil-menu-email');
    const av = document.getElementById('perfil-menu-avatar');
    if (el) el.textContent = name;
    if (em) em.textContent = email;
    if (av) av.src = picture;
  }

  // ── Token: renovação silenciosa ───────────────────────
  function refreshTokenSilent() {
    return new Promise((resolve) => {
      if (!_tokenClient) { resolve(); return; }
      _tokenClient.requestAccessToken({ prompt: '' });
      setTimeout(resolve, 1000);
    });
  }

  // ── Autenticação Google ───────────────────────────────
  function initGoogleAuth() {
    const tryInit = () => {
      if (typeof google === 'undefined') { setTimeout(tryInit, 200); return; }

      google.accounts.id.initialize({
        client_id: CONFIG.CLIENT_ID,
        callback: handleCredential,
        auto_select: true,
        cancel_on_tap_outside: false,
      });

      google.accounts.id.renderButton(
        document.getElementById('google-btn-container'),
        { theme: 'outline', size: 'large', width: 280, text: 'signin_with', shape: 'pill' }
      );

      google.accounts.id.prompt((notification) => {
        if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
          tryRestoreSession();
        }
      });
    };
    tryInit();
  }

  function tryRestoreSession() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      if (!CONFIG.ALLOWED_EMAILS.includes(data.email)) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      _userPayload = data;
      setupTokenClient(data, true);
    } catch(e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function handleCredential(response) {
    const payload = parseJwt(response.credential);

    if (!CONFIG.ALLOWED_EMAILS.includes(payload.email)) {
      alert(`Acesso negado.\n\nEste app é exclusivo da família.\nConta usada: ${payload.email}`);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      email:   payload.email,
      name:    payload.given_name || payload.name || payload.email,
      picture: payload.picture || '',
    }));

    _userPayload = payload;
    setupTokenClient(payload, false);
  }

  function setupTokenClient(userInfo, silent) {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      hint: userInfo.email,
      callback: (tokenResponse) => {
        if (tokenResponse.error) { showLogin(); return; }
        _token = tokenResponse.access_token;
        _tokenExpiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
        Sheets.setToken(_token);
        if (_userPayload || userInfo) onLoginSuccess(userInfo);
      },
    });

    _tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
  }

  async function onLoginSuccess(userInfo) {
    const name    = userInfo.given_name || userInfo.name || userInfo.email;
    const email   = userInfo.email || '';
    const picture = userInfo.picture || '';

    // Topbar e sidebar
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-avatar').src = picture;
    document.getElementById('user-avatar-mobile').src = picture;

    // Menu de perfil mobile
    updatePerfilMenu(name, email, picture);

    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');

    try { await Sheets.initSpreadsheet(); } catch(e) { console.warn(e); }

    loadPage('painel');

    // Renova token a cada 50 min
    setInterval(refreshTokenSilent, 50 * 60 * 1000);

    // Refresh dos dados a cada 5 min
    setInterval(() => {
      if (document.visibilityState === 'visible') loadPage(_currentPage);
    }, 5 * 60 * 1000);
  }

  function showLogin() {
    document.getElementById('screen-app').classList.remove('active');
    document.getElementById('screen-login').classList.add('active');
  }

  // ── Logout ────────────────────────────────────────────
  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    _token = null;
    _userPayload = null;
    _tokenExpiry = 0;
    _navHistory = ['painel'];
    if (_perfilOpen) togglePerfilMenu();
    google.accounts.id.disableAutoSelect();
    showLogin();
  }

  // ── Utils ─────────────────────────────────────────────
  function parseJwt(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(r => console.log('SW:', r.scope))
        .catch(e => console.log('SW erro:', e));
    }
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    document.getElementById('modal-close').addEventListener('click', Pages.closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) Pages.closeModal();
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
      Pages.toast('Atualizando…');
      loadPage(_currentPage);
    });

    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('btn-logout-mobile')?.addEventListener('click', logout);

    // Botão voltar Android
    initBackButton();

    initGoogleAuth();
    registerSW();
  }

  return { init, navigateTo, togglePerfilMenu, cancelExit, confirmExit };
})();

document.addEventListener('DOMContentLoaded', App.init);
