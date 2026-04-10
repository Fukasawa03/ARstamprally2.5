'use strict';
/* ============================================================
   WebAR Stamp Rally — app.js
   
   アーキテクチャ:
   - AR: MindAR.js 単体（A-Frame不使用）→ iOS/Android両対応
   - 即時反映: Firebase Realtime Database
   - ローカル: IndexedDB (個人の進捗保存)
   ============================================================ */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. IndexedDB ラッパー (個人進捗保存用)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var DB = (function () {
  var NAME = 'StampRallyDB', VER = 1, _db = null;
  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (res, rej) {
      var q = indexedDB.open(NAME, VER);
      q.onupgradeneeded = function (e) {
        if (!e.target.result.objectStoreNames.contains('kv'))
          e.target.result.createObjectStore('kv');
      };
      q.onsuccess = function (e) { _db = e.target.result; res(_db); };
      q.onerror   = function () { rej(q.error); };
    });
  }
  function get(k) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction('kv','readonly').objectStore('kv').get(k);
        q.onsuccess = function () { res(q.result !== undefined ? q.result : null); };
        q.onerror   = function () { rej(q.error); };
      });
    }).catch(function () {
      var v = localStorage.getItem('sr_' + k); return v ? JSON.parse(v) : null;
    });
  }
  function set(k, v) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv','readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    }).catch(function () { localStorage.setItem('sr_' + k, JSON.stringify(v)); });
  }
  function del(k) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv','readwrite');
        tx.objectStore('kv').delete(k);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    }).catch(function () { localStorage.removeItem('sr_' + k); });
  }
  return { get: get, set: set, del: del };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. Firebase管理
   即時反映の仕組み:
   - 管理者が設定を保存 → Firebase に書き込む
   - 参加者はページ読み込み時に Firebase から読む
   - 管理者パネルは onValue でリアルタイム監視
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var FirebaseManager = (function () {
  var _app = null, _db = null, _connected = false;

  function init(fbConfig) {
    if (!fbConfig || !fbConfig.apiKey || !fbConfig.databaseURL) return false;
    try {
      // 既存アプリがあれば再利用
      try { _app = firebase.app(); } catch(e) { _app = firebase.initializeApp(fbConfig); }
      _db = firebase.database();
      _connected = true;
      updateSyncBanner(true);
      return true;
    } catch (e) {
      console.error('Firebase init error:', e);
      return false;
    }
  }

  function updateSyncBanner(ok) {
    var banner = document.getElementById('sync-banner');
    var status = document.getElementById('sync-status');
    if (!banner || !status) return;
    if (ok) {
      banner.className = 'firebase-sync-banner connected';
      status.textContent = '🟢 Firebase接続済み — 保存すると参加者全員に即時反映されます';
    } else {
      banner.className = 'firebase-sync-banner';
      status.textContent = '🔴 Firebase未接続 — システムタブで設定してください';
    }
  }

  // 設定をFirebaseに書き込む
  function saveConfig(cfg) {
    if (!_connected || !_db) return Promise.reject(new Error('not connected'));
    // mindFilesのdataは巨大なのでFirebaseには保存しない
    var toSave = JSON.parse(JSON.stringify(cfg));
    if (toSave.mindFiles) {
      toSave.mindFiles = toSave.mindFiles.map(function (f) {
        return { name: f.name };
      });
    }
    return _db.ref('settings').set(toSave);
  }

  // Firebaseから設定を1回読む
  function loadConfig() {
    if (!_connected || !_db) return Promise.resolve(null);
    return _db.ref('settings').once('value').then(function (snap) {
      return snap.val();
    });
  }

  // 設定の変更をリアルタイム監視（管理者用）
  function watchConfig(callback) {
    if (!_connected || !_db) return function () {};
    var ref = _db.ref('settings');
    ref.on('value', function (snap) {
      var data = snap.val();
      if (data) callback(data);
    });
    return function () { ref.off(); };
  }

  function isConnected() { return _connected; }

  return { init: init, saveConfig: saveConfig, loadConfig: loadConfig, watchConfig: watchConfig, isConnected: isConnected };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. デフォルト設定
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var DEFAULT_CONFIG = {
  versionId: '2026_Ver1',
  adminPassword: 'admin',
  eventYear: '2026',
  eventTitle: '文化祭\nスタンプラリー',
  eventSubtitle: '全スタンプを集めて特典をゲットしよう！',
  startConfirmTitle: 'スタートしますか？',
  startConfirmDesc: 'タイマーが開始されます。\n準備ができたら「スタート！」を押してください。',
  startConfirmOk: 'スタート！',
  startConfirmCancel: 'キャンセル',
  ui: {
    btnStart: 'スタート！',
    btnHowto: '遊び方',
    howtoTitle: '遊び方',
    mapTitle: 'スタンプマップ',
    progressLabel: '進捗',
    btnScan: 'ARスキャン開始',
    arTitle: 'マーカーを照らして！',
    arHint: 'マーカーを枠内に合わせてください',
    arCameraMsg: 'カメラ起動中...',
    arCameraFallback: 'カメラを使用できません。合言葉入力をお試しください',
    stampNewTag: 'スタンプ獲得！',
    stampAlreadyTag: '獲得済み',
    btnStampBack: 'マップに戻る',
    completeTitle: 'コンプリート！',
    completeSubtitle: '全スタンプ制覇おめでとう！',
    completeTimeLabel: 'クリアタイム',
    btnCompleteMap: 'スタンプ一覧を見る',
    manualTitle: '合言葉入力',
    manualDesc: 'スタンプ地点に掲示された数字を入力してください',
  },
  coupon: {
    title: '🎁 特典クーポン',
    body: '文化祭グッズ引換券！本部で見せてください',
    code: 'FES-2026-COMP',
  },
  howtoSteps: [
    { title: 'アプリを開く',      desc: 'このページをホーム画面に追加しておくと便利です。' },
    { title: 'スタンプ場所へ行く', desc: 'マップから場所を確認して出発しましょう！' },
    { title: 'マーカーをスキャン', desc: '「ARスキャン開始」を押してカメラをマーカーに向けてください。' },
    { title: 'スタンプをゲット',   desc: 'スキャン成功！スタンプが記録されます。' },
    { title: 'コンプリートで特典', desc: '全スタンプを集めると特典クーポンが表示されます！' },
  ],
  stamps: [
    { id:'s01', name:'科学部の秘密実験', location:'3階 理科室', message:'サイエンスの世界へようこそ！', emoji:'🔬', code:'1234', mindFile:'', modelUrl:'' },
    { id:'s02', name:'美術部ギャラリー',  location:'2階 美術室', message:'芸術に触れてみよう！',         emoji:'🎨', code:'2345', mindFile:'', modelUrl:'' },
    { id:'s03', name:'音楽部ライブ',      location:'体育館',     message:'音楽の力を感じてください！',   emoji:'🎵', code:'3456', mindFile:'', modelUrl:'' },
  ],
  mindFiles: [],
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. Config管理
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var Config = (function () {
  var _cfg = null;

  function deepMerge(target, source) {
    var out = Object.assign({}, target);
    Object.keys(source || {}).forEach(function (k) {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = deepMerge(target[k] || {}, source[k]);
      } else {
        out[k] = source[k];
      }
    });
    return out;
  }

  function load() {
    // まずローカルキャッシュを読む
    return DB.get('config').then(function (cached) {
      _cfg = cached ? deepMerge(DEFAULT_CONFIG, cached) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));

      // Firebase設定があれば接続し、最新設定を取得
      return DB.get('firebaseConfig').then(function (fbCfg) {
        if (fbCfg && fbCfg.apiKey) {
          var ok = FirebaseManager.init(fbCfg);
          if (ok) {
            return FirebaseManager.loadConfig().then(function (remoteCfg) {
              if (remoteCfg) {
                _cfg = deepMerge(_cfg, remoteCfg);
                // mindFilesはローカルのみ (base64データはFirebaseに入らないため)
                if (cached && cached.mindFiles) _cfg.mindFiles = cached.mindFiles;
              }
              return DB.set('config', _cfg);
            }).catch(function () {});
          }
        }
      });
    }).then(function () {
      // バージョンチェック (年度リセット)
      return DB.get('versionId').then(function (savedVer) {
        if (savedVer && savedVer !== _cfg.versionId) {
          return Promise.all([DB.del('progress'), DB.del('timerBase'), DB.del('timerRunSince'), DB.del('completed')]);
        }
      });
    }).then(function () {
      return DB.set('versionId', _cfg.versionId);
    }).then(function () {
      return _cfg;
    });
  }

  function save() {
    return DB.set('config', _cfg).then(function () {
      // Firebase接続済みなら即時反映
      if (FirebaseManager.isConnected()) {
        return FirebaseManager.saveConfig(_cfg).catch(function (e) {
          console.warn('Firebase save failed:', e);
        });
      }
    });
  }

  function get()            { return _cfg; }
  function set(newCfg)      { _cfg = newCfg; }

  return { load: load, save: save, get: get, set: set, deepMerge: deepMerge };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. State (個人進捗)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var State = (function () {
  var _acq = {}, _base = 0, _runSince = null, _running = false, _iv = null;
  var _completed = false;

  function load() {
    return Promise.all([
      DB.get('progress'), DB.get('timerBase'), DB.get('timerRunSince'), DB.get('completed'),
    ]).then(function (v) {
      if (v[0]) v[0].forEach(function (id) { _acq[id] = true; });
      _base = v[1] || 0;
      _completed = !!v[3];
      if (v[2]) {
        _base += (Date.now() - v[2]);
        DB.set('timerBase', _base);
        DB.del('timerRunSince');
        if (!_completed) {
          _runSince = Date.now(); _running = true;
          DB.set('timerRunSince', _runSince);
          _iv = setInterval(function () { UI.updateTimer(getElapsed()); }, 500);
        }
      }
    });
  }

  function startTimer() {
    if (_running || _completed) return;
    _running = true; _runSince = Date.now();
    DB.set('timerRunSince', _runSince);
    _iv = setInterval(function () { UI.updateTimer(getElapsed()); }, 500);
  }

  function stopTimer() {
    if (!_running) return;
    _base += (Date.now() - _runSince);
    _running = false; _runSince = null;
    clearInterval(_iv); _iv = null;
    DB.set('timerBase', _base); DB.del('timerRunSince');
  }

  function getElapsed() { return _running ? _base + (Date.now() - _runSince) : _base; }

  function acquireStamp(id) {
    if (_acq[id]) return Promise.resolve(false);
    _acq[id] = true;
    return DB.set('progress', Object.keys(_acq)).then(function () { return true; });
  }

  function isAcquired(id) { return !!_acq[id]; }
  function getCount()     { return Object.keys(_acq).length; }
  function isCompleted()  { return _completed; }

  function setCompleted() {
    _completed = true; stopTimer(); DB.set('completed', true);
  }

  function reset() {
    _acq = {}; _base = 0; _runSince = null; _running = false; _completed = false;
    clearInterval(_iv); _iv = null;
    return Promise.all([
      DB.del('progress'), DB.del('timerBase'), DB.del('timerRunSince'),
      DB.del('completed'), DB.del('couponUsed'),
    ]);
  }

  return {
    load: load,
    startTimer: startTimer, stopTimer: stopTimer, getElapsed: getElapsed,
    acquireStamp: acquireStamp, isAcquired: isAcquired, getCount: getCount,
    isCompleted: isCompleted, setCompleted: setCompleted, reset: reset,
  };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. UI
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var UI = (function () {
  var _toastTimer = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.style.display = 'none'; s.classList.remove('active');
    });
    var el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
  }

  function showModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'flex'; }
  function hideModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

  function toast(msg, dur) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { el.style.display = 'none'; }, dur || 2500);
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function fmtTime(ms) {
    var t = Math.floor(ms / 1000);
    return pad(Math.floor(t / 60)) + ':' + pad(t % 60);
  }
  function updateTimer(ms) {
    var el = document.getElementById('timer-display');
    if (el) el.textContent = fmtTime(ms);
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function st(id, v) {
    var el = document.getElementById(id);
    if (!el || v === undefined) return;
    // \n を改行として扱う
    if (String(v).indexOf('\\n') !== -1 || String(v).indexOf('\n') !== -1) {
      el.innerHTML = esc(String(v)).replace(/\\n|\n/g, '<br>');
    } else {
      el.textContent = String(v);
    }
  }

  function applyConfig(cfg) {
    st('ui-event-year',          cfg.eventYear);
    st('ui-event-title',         cfg.eventTitle);
    st('ui-event-subtitle',      cfg.eventSubtitle);
    st('ui-btn-start',           cfg.ui.btnStart);
    st('ui-btn-howto',           cfg.ui.btnHowto);
    st('ui-howto-title',         cfg.ui.howtoTitle);
    st('ui-map-title',           cfg.ui.mapTitle);
    st('ui-progress-label',      cfg.ui.progressLabel);
    st('ui-btn-scan',            cfg.ui.btnScan);
    st('ui-ar-title',            cfg.ui.arTitle);
    st('ui-ar-hint',             cfg.ui.arHint);
    st('ui-manual-title',        cfg.ui.manualTitle);
    st('ui-manual-desc',         cfg.ui.manualDesc);
    st('ui-complete-title',      cfg.ui.completeTitle);
    st('ui-complete-subtitle',   cfg.ui.completeSubtitle);
    st('ui-complete-time-label', cfg.ui.completeTimeLabel);
    st('ui-coupon-title',        cfg.coupon.title);
    st('ui-coupon-body',         cfg.coupon.body);
    st('ui-coupon-code',         cfg.coupon.code);
    st('ui-start-confirm-title', cfg.startConfirmTitle);
    st('ui-start-confirm-desc',  cfg.startConfirmDesc);
    st('ui-start-confirm-ok',    cfg.startConfirmOk);

    var btnCompleteMap = document.getElementById('btn-complete-map');
    if (btnCompleteMap) btnCompleteMap.textContent = cfg.ui.btnCompleteMap;

    var btnCancel = document.getElementById('btn-start-cancel');
    if (btnCancel) btnCancel.textContent = cfg.startConfirmCancel || 'キャンセル';

    document.title = (cfg.eventTitle || '').replace(/\\n|\n/g,'') + ' ' + cfg.eventYear;
  }

  function renderHowtoSteps(steps) {
    var c = document.getElementById('howto-steps');
    if (!c) return;
    c.innerHTML = (steps || []).map(function (s, i) {
      return '<div class="howto-step"><div class="howto-step-num">' + (i + 1) + '</div>'
        + '<div class="howto-step-body"><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div></div>';
    }).join('');
  }

  function renderStampList(stamps) {
    var list = document.getElementById('stamp-list');
    if (!list) return;
    list.innerHTML = (stamps || []).map(function (s) {
      var acq = State.isAcquired(s.id);
      return '<div class="stamp-item' + (acq ? ' acquired' : '') + '" data-id="' + s.id + '">'
        + '<div class="s-emoji">' + esc(s.emoji || '⭐') + '</div>'
        + '<div class="s-info"><div class="s-name">' + esc(s.name) + '</div>'
        + '<div class="s-loc">📍 ' + esc(s.location) + '</div></div>'
        + '<div class="s-check">' + (acq ? '✓' : '') + '</div>'
        + '</div>';
    }).join('');
  }

  function updateProgress(stamps) {
    var total = (stamps || []).length, count = State.getCount();
    if (total === 0) { count = 0; }
    var pct = total ? Math.round(count / total * 100) : 0;
    var bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = pct + '%';
    var lbl = document.getElementById('progress-count');
    if (lbl) lbl.textContent = count + ' / ' + total;
    renderStampList(stamps);
  }

  function applyCompletedMapFooter(cfg) {
    var btn = document.getElementById('btn-go-scan');
    if (!btn) return;
    btn.innerHTML = '<span>🏆</span><span>' + esc(cfg.ui.btnCompleteMap || 'コンプリート画面へ') + '</span>';
    btn.classList.remove('btn-glow');
    btn.style.background = 'linear-gradient(135deg, #ffce00, #ff8c00)';
    btn.style.boxShadow  = '0 4px 22px rgba(255,206,0,.35)';
  }

  function showStampDetail(stamp, isNew) {
    document.getElementById('sa-emoji').textContent    = stamp.emoji || '⭐';
    document.getElementById('sa-name').textContent     = stamp.name;
    document.getElementById('sa-location').textContent = stamp.location;
    document.getElementById('sa-message').textContent  = stamp.message || '';
    var cfg  = Config.get();
    var tag  = document.getElementById('sa-status-tag');
    var back = document.getElementById('btn-stamp-back');
    if (tag) {
      tag.textContent = isNew
        ? (cfg && cfg.ui.stampNewTag || 'スタンプ獲得！')
        : (cfg && cfg.ui.stampAlreadyTag || '獲得済み');
      tag.className = 'stamp-tag' + (isNew ? '' : ' already');
    }
    if (back) back.textContent = cfg && cfg.ui.btnStampBack || 'マップに戻る';
    showScreen('screen-stamp');
    if (isNew) {
      var c = document.getElementById('sparkles-container');
      if (c) {
        c.innerHTML = '';
        var cols = ['#c840ff','#00f0ff','#ffce00','#00e87a'];
        for (var i = 0; i < 22; i++) {
          var d = document.createElement('div');
          d.className = 'sparkle';
          var sz = 5 + Math.random() * 8;
          var tx = (Math.random() - 0.5) * 200;
          var ty = -(40 + Math.random() * 120);
          d.style.cssText = 'left:' + Math.random() * 100 + '%;top:' + (50 + Math.random() * 40) + '%;'
            + 'width:' + sz + 'px;height:' + sz + 'px;background:' + cols[i % 4] + ';'
            + '--tx:' + tx + 'px;--ty:' + ty + 'px;'
            + '--d:' + (1 + Math.random()) + 's;--dl:' + (Math.random() * 0.4) + 's;';
          c.appendChild(d);
        }
      }
    }
  }

  function showComplete(elapsed) {
    document.getElementById('complete-time-value').textContent = fmtTime(elapsed);
    DB.get('couponUsed').then(function (used) {
      var card     = document.getElementById('coupon-card');
      var useArea  = document.getElementById('coupon-use-area');
      var usedArea = document.getElementById('coupon-used-area');
      if (used) {
        if (card) card.classList.add('used');
        if (useArea) useArea.style.display  = 'none';
        if (usedArea) usedArea.style.display = 'block';
      } else {
        if (card) card.classList.remove('used');
        if (useArea) useArea.style.display  = 'block';
        if (usedArea) usedArea.style.display = 'none';
      }
    });
    showScreen('screen-complete');
    launchConfetti();
  }

  function launchConfetti() {
    var canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var ctx = canvas.getContext('2d');
    var cols = ['#c840ff','#00f0ff','#ffce00','#00e87a','#ff4458','#fff'];
    var pp = [];
    for (var i = 0; i < 140; i++) {
      pp.push({
        x: Math.random() * canvas.width, y: -20 - Math.random() * 200,
        r: 4 + Math.random() * 7, c: cols[i % 6],
        sp: 2 + Math.random() * 3.5, dr: (Math.random() - 0.5) * 1.5,
        a: Math.random() * Math.PI * 2, sa: (Math.random() - 0.5) * 0.15,
      });
    }
    var fr;
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pp.forEach(function (p) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r * 1.8);
        ctx.restore();
        p.y += p.sp; p.x += p.dr; p.a += p.sa;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      fr = requestAnimationFrame(draw);
    }());
    setTimeout(function () { cancelAnimationFrame(fr); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 9000);
  }

  function renderStars() {
    var c = document.getElementById('stars');
    if (!c) return;
    var f = document.createDocumentFragment();
    for (var i = 0; i < 60; i++) {
      var el = document.createElement('div');
      el.className = 'star';
      var sz = 1 + Math.random() * 2.5;
      el.style.cssText = 'left:' + Math.random() * 100 + '%;top:' + Math.random() * 100 + '%;'
        + 'width:' + sz + 'px;height:' + sz + 'px;'
        + '--d:' + (2 + Math.random() * 4) + 's;--dl:' + (Math.random() * 4) + 's;';
      f.appendChild(el);
    }
    c.appendChild(f);
  }

  return {
    showScreen: showScreen, showModal: showModal, hideModal: hideModal,
    toast: toast, fmtTime: fmtTime, updateTimer: updateTimer, esc: esc,
    applyConfig: applyConfig, renderHowtoSteps: renderHowtoSteps,
    renderStampList: renderStampList, updateProgress: updateProgress,
    applyCompletedMapFooter: applyCompletedMapFooter,
    showStampDetail: showStampDetail, showComplete: showComplete,
    renderStars: renderStars,
  };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   7. AR (MindAR v1.1.5 + Three.js)
   - mindar-image-three.prod.js を <script> で読み込む
   - window.MINDAR.IMAGE.MindARThree / window.MINDAR.IMAGE.THREE を使う
   - uiLoading:'no' でデフォルトUI非表示
   - warmupTolerance:1 で即時反応
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var AR = (function () {
  var _stamps        = [];
  var _onDetect      = null;
  var _cd            = {};
  var _mindar        = null;
  var _mindBlobUrl   = null;
  var _scriptsLoaded = false;

  function init(stamps, onDetect) { _stamps = stamps; _onDetect = onDetect; }

  function setMsg(text) {
    var el = document.getElementById('ar-msg');
    if (el) el.textContent = text || '';
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[data-ar="' + src + '"]')) { res(); return; }
      var s = document.createElement('script');
      s.setAttribute('data-ar', src);
      s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function startScene() {
    UI.showScreen('screen-ar');
    var cfg = Config.get();
    setMsg((cfg && cfg.ui.arCameraMsg) || 'カメラ起動中...');

    var arStamps = (_stamps || []).filter(function (s) { return s.mindFile && s.mindFileData; });
    if (arStamps.length === 0) {
      setMsg((cfg && cfg.ui.arCameraFallback) || '合言葉入力をご利用ください（.mindファイル未設定）');
      return;
    }

    var MINDAR_URL = 'https://cdn.jsdelivr.net/npm/mind-ar@1.1.5/dist/mindar-image-three.prod.js';
    var loadPromise = _scriptsLoaded
      ? Promise.resolve()
      : loadScript(MINDAR_URL).then(function () {
          _scriptsLoaded = true;
          return new Promise(function (res) { setTimeout(res, 150); });
        });

    loadPromise
      .then(function () { setMsg(''); buildMindAR(arStamps); })
      .catch(function (e) {
        console.error('MindAR script load error:', e);
        setMsg('ライブラリの読み込みに失敗しました');
      });
  }

  function buildMindAR(arStamps) {
    var container = document.getElementById('ar-container');
    if (!container) return;
    container.innerHTML = '';

    // .mindファイル → Blob URL
    var mindData = arStamps[0].mindFileData;
    if (_mindBlobUrl) { try { URL.revokeObjectURL(_mindBlobUrl); } catch(e) {} _mindBlobUrl = null; }
    try {
      var base64 = mindData.split(',')[1];
      if (!base64) throw new Error('base64 missing');
      var byteStr = atob(base64);
      var arr = new Uint8Array(byteStr.length);
      for (var i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      _mindBlobUrl = URL.createObjectURL(new Blob([arr], { type: 'application/octet-stream' }));
    } catch (e) {
      console.error('mindFile decode error:', e);
      setMsg('.mindファイルの読み込みに失敗しました'); return;
    }

    if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.MindARThree) {
      setMsg('ARライブラリが正しく読み込まれていません');
      console.error('window.MINDAR.IMAGE.MindARThree not found'); return;
    }

    try {
      _mindar = new window.MINDAR.IMAGE.MindARThree({
        container:       container,
        imageTargetSrc:  _mindBlobUrl,
        maxTrack:        arStamps.length,
        uiLoading:       'no',   // デフォルトUI非表示
        uiScanning:      'no',
        uiError:         'no',
        warmupTolerance: 1,      // 1フレームで即反応（デフォルト5）
        missTolerance:   5,      // 見失い判定は少し余裕を持たせる
        filterMinCF:     0.001,
        filterBeta:      1000,
      });
    } catch (e) {
      console.error('MindARThree init error:', e);
      setMsg('AR初期化に失敗しました'); return;
    }

    var THREE    = window.MINDAR.IMAGE.THREE;
    var renderer = _mindar.renderer;
    var scene    = _mindar.scene;
    var camera   = _mindar.camera;

    // Retina対応: デバイス物理ピクセルでレンダリング
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    // canvasの背景を透明に（黒い点対策）
    renderer.setClearColor(0x000000, 0);
    renderer.alpha = true;

    // アンカー設定
    arStamps.forEach(function (stamp, idx) {
      var anchor = _mindar.addAnchor(idx);

      // メッシュはデフォルト非表示→マーカー検出時だけ表示（黒い点対策）
      var geo  = new THREE.PlaneGeometry(1, 1);
      var mat  = new THREE.MeshBasicMaterial({ color: 0xc840ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      anchor.group.add(mesh);

      anchor.onTargetFound = function () {
        mesh.visible = true;
        handleDetect(stamp);
      };
      anchor.onTargetLost = function () {
        mesh.visible = false;
      };
    });

    // start() でカメラ許可ダイアログが出て映像開始
    _mindar.start()
      .then(function () {
        setMsg('');

        // MindARが生成するUI要素（黒い点など）を強制削除
        setTimeout(function () {
          container.querySelectorAll('div').forEach(function (el) {
            el.remove();
          });
        }, 800);

        // MindARが生成したvideoに高解像度制約を上書き
        var vid = container.querySelector('video');
        if (vid && vid.srcObject) {
          var track = vid.srcObject.getVideoTracks()[0];
          if (track && track.applyConstraints) {
            track.applyConstraints({
              width:       { ideal: 1920 },
              height:      { ideal: 1080 },
              facingMode:  'environment',
            }).catch(function () {});
          }
        }

        renderer.setAnimationLoop(function () {
          renderer.render(scene, camera);
        });
      })
      .catch(function (e) {
        console.error('MindAR start error:', e.name, e.message);
        var cfg = Config.get();
        var msg = (cfg && cfg.ui.arCameraFallback) || 'カメラを起動できませんでした';
        if (e && e.name === 'NotAllowedError') {
          msg = 'カメラの使用が拒否されました。設定→Safari→カメラを「許可」にしてください';
        } else if (e && e.name === 'NotFoundError') {
          msg = 'カメラが見つかりません';
        }
        setMsg(msg);
      });
  }

  function destroyScene() {
    if (_mindar) {
      try { _mindar.renderer.setAnimationLoop(null); } catch(e) {}
      try { _mindar.stop(); } catch(e) {}
      _mindar = null;
    }
    document.querySelectorAll('video').forEach(function (v) {
      try {
        if (v.srcObject) { v.srcObject.getTracks().forEach(function (t) { t.stop(); }); v.srcObject = null; }
      } catch(e) {}
    });
    if (_mindBlobUrl) { try { URL.revokeObjectURL(_mindBlobUrl); } catch(e) {} _mindBlobUrl = null; }
    var container = document.getElementById('ar-container');
    if (container) container.innerHTML = '';
    _cd = {};
  }

    function handleDetect(stamp) {
    var now = Date.now();
    if (_cd[stamp.id] && now - _cd[stamp.id] < 4000) return;
    _cd[stamp.id] = now;
    var banner = document.getElementById('ar-banner');
    if (banner) {
      document.getElementById('ar-banner-emoji').textContent = stamp.emoji || '🎉';
      document.getElementById('ar-banner-text').textContent  = stamp.name + ' をスキャン！';
      banner.style.display = 'flex';
      setTimeout(function () { banner.style.display = 'none'; }, 3000);
    }
    if (_onDetect) _onDetect(stamp);
  }

  return { init: init, startScene: startScene, destroyScene: destroyScene };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   8. ドラッグ&ドロップ
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function makeDraggable(listEl, onReorder) {
  var src = null, ghost = null, touchItem = null;
  function items() { return Array.from(listEl.querySelectorAll('.stamp-admin-item')); }
  function idxOf(el) { return items().indexOf(el); }
  function itemAtY(y) {
    return items().find(function (i) {
      var r = i.getBoundingClientRect(); return y >= r.top && y <= r.bottom;
    }) || null;
  }
  function cleanup() { items().forEach(function (i) { i.classList.remove('dragging','drag-over'); }); src = null; }

  function rebind() {
    items().forEach(function (item) {
      item.setAttribute('draggable','true');
      item.ondragstart = function () { src = item; item.classList.add('dragging'); };
      item.ondragover  = function (e) { e.preventDefault(); items().forEach(function (i) { i.classList.remove('drag-over'); }); item.classList.add('drag-over'); };
      item.ondrop      = function (e) { e.preventDefault(); var si=idxOf(src),di=idxOf(item); if(src&&si!==di) onReorder(si,di); cleanup(); };
      item.ondragend   = cleanup;
      var handle = item.querySelector('.drag-icon');
      if (!handle) return;
      handle.ontouchstart = function (e) {
        touchItem = item; item.classList.add('dragging');
        ghost = item.cloneNode(true);
        var r = item.getBoundingClientRect();
        ghost.style.cssText = 'position:fixed;z-index:9999;left:'+r.left+'px;top:'+r.top+'px;width:'+item.offsetWidth+'px;opacity:.85;pointer-events:none;background:var(--surf2);border:1.5px solid var(--accent);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
        document.body.appendChild(ghost); e.preventDefault();
      };
    });
    document.ontouchmove = function (e) {
      if (!touchItem || !ghost) return;
      var t = e.touches[0];
      ghost.style.top = (t.clientY - 30) + 'px';
      items().forEach(function (i) { i.classList.remove('drag-over'); });
      var over = itemAtY(t.clientY);
      if (over && over !== touchItem) over.classList.add('drag-over');
      e.preventDefault();
    };
    document.ontouchend = function (e) {
      if (!touchItem || !ghost) return;
      var t = e.changedTouches[0], over = itemAtY(t.clientY);
      var si = idxOf(touchItem), di = over ? idxOf(over) : -1;
      if (over && si !== di && di >= 0) onReorder(si, di);
      ghost.remove(); ghost = null;
      items().forEach(function (i) { i.classList.remove('dragging','drag-over'); });
      touchItem = null;
    };
  }
  return { rebind: rebind };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   9. Admin
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var Admin = (function () {
  var _cfg = null, _drag = null;

  function init(cfg) {
    _cfg = cfg;
    renderAll();
    bindStatic();
    bindTabs();
    // Firebase接続済みなら設定変更をリアルタイム監視
    if (FirebaseManager.isConnected()) {
      FirebaseManager.watchConfig(function (remoteCfg) {
        // 管理者パネルで自分が書き込んだ変更は無視（ループ防止はFirebaseが自動処理）
        _cfg = Config.deepMerge(_cfg, remoteCfg);
        Config.set(_cfg);
        UI.applyConfig(_cfg);
        UI.renderHowtoSteps(_cfg.howtoSteps);
        UI.updateProgress(_cfg.stamps);
      });
    }
  }

  function renderAll() {
    renderStampList_();
    renderMindList();
    renderTextEditors();
    renderHowtoEditor();
    var vb = document.getElementById('admin-ver-badge');
    if (vb) vb.textContent = 'v: ' + _cfg.versionId;
    var vi = document.getElementById('admin-version-id');
    if (vi) vi.value = _cfg.versionId;
  }

  function renderStampList_() {
    var list = document.getElementById('stamp-admin-list');
    if (!list) return;
    list.innerHTML = (_cfg.stamps || []).map(function (s, i) {
      var hasFile = s.mindFile ? '✅ ' + s.mindFile : '⚠ .mindファイル未設定';
      return '<div class="stamp-admin-item" data-idx="' + i + '">'
        + '<span class="drag-icon">☰</span>'
        + '<span class="sa-emoji">' + UI.esc(s.emoji || '⭐') + '</span>'
        + '<div class="sa-info">'
        + '<div class="sa-name">' + UI.esc(s.name) + '</div>'
        + '<div class="sa-sub">' + UI.esc(hasFile) + ' | 合言葉: ' + UI.esc(s.code || '—') + '</div>'
        + '</div>'
        + '<button class="sa-edit-btn" data-id="' + s.id + '">編集</button>'
        + '</div>';
    }).join('');
    list.querySelectorAll('.sa-edit-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openEdit(b.dataset.id); };
    });
    if (!_drag) {
      _drag = makeDraggable(list, function (si, di) {
        var a = _cfg.stamps.slice(), m = a.splice(si, 1)[0];
        a.splice(di, 0, m);
        _cfg.stamps = a;
        Config.save().then(function () {
          renderStampList_();
          UI.updateProgress(_cfg.stamps);
          UI.toast('並び順を更新しました ✓');
        });
      });
    }
    _drag.rebind();
  }

  function renderMindList() {
    var list = document.getElementById('mind-file-list');
    if (!list) return;
    var files = _cfg.mindFiles || [];
    if (!files.length) {
      list.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:8px 0">登録ファイルなし</p>';
      return;
    }
    list.innerHTML = files.map(function (f, i) {
      var linked = (_cfg.stamps || []).find(function (s) { return s.mindFile === f.name; });
      return '<div class="mind-file-item">'
        + '<span style="font-size:20px">📄</span>'
        + '<div class="mind-file-name">' + UI.esc(f.name) + '</div>'
        + '<div class="mind-file-linked">' + (linked ? '→ ' + UI.esc(linked.name) : '未リンク') + '</div>'
        + '<button style="color:var(--red);font-size:18px;padding:2px 6px" data-idx="' + i + '">🗑</button>'
        + '</div>';
    }).join('');
    list.querySelectorAll('[data-idx]').forEach(function (b) {
      b.onclick = function () {
        var idx  = parseInt(b.dataset.idx);
        var name = _cfg.mindFiles[idx].name;
        _cfg.mindFiles.splice(idx, 1);
        (_cfg.stamps || []).forEach(function (s) { if (s.mindFile === name) { s.mindFile = ''; s.mindFileData = ''; } });
        Config.save().then(function () { renderMindList(); renderStampList_(); UI.toast('削除しました'); });
      };
    });
  }

  function renderTextEditors() {
    renderGroup('te-event', [
      { key:'eventYear',    label:'年度（バッジに表示）' },
      { key:'eventTitle',   label:'タイトル（改行は \\n と入力）' },
      { key:'eventSubtitle',label:'サブタイトル' },
    ]);
    renderGroup('te-start', [
      { key:'startConfirmTitle',  label:'確認ダイアログ タイトル' },
      { key:'startConfirmDesc',   label:'確認ダイアログ 説明文' },
      { key:'startConfirmOk',     label:'「スタート！」ボタン' },
      { key:'startConfirmCancel', label:'「キャンセル」ボタン' },
      { key:'ui.btnStart',        label:'タイトル画面 スタートボタン' },
      { key:'ui.btnHowto',        label:'タイトル画面 遊び方ボタン' },
    ]);
    renderGroup('te-map', [
      { key:'ui.mapTitle',      label:'マップ画面 タイトル' },
      { key:'ui.progressLabel', label:'進捗ラベル' },
      { key:'ui.btnScan',       label:'ARスキャン開始ボタン' },
    ]);
    renderGroup('te-ar', [
      { key:'ui.arTitle',          label:'ARスキャン画面 タイトル' },
      { key:'ui.arHint',           label:'スキャンヒント文' },
      { key:'ui.arCameraMsg',      label:'カメラ起動中メッセージ' },
      { key:'ui.arCameraFallback', label:'カメラ失敗時メッセージ' },
    ]);
    renderGroup('te-stamp', [
      { key:'ui.stampNewTag',    label:'スタンプ新規獲得 タグ' },
      { key:'ui.stampAlreadyTag',label:'スタンプ獲得済み タグ' },
      { key:'ui.btnStampBack',   label:'スタンプ画面「マップに戻る」ボタン' },
      { key:'ui.manualTitle',    label:'合言葉モーダル タイトル' },
      { key:'ui.manualDesc',     label:'合言葉モーダル 説明文' },
    ]);
    renderGroup('te-complete', [
      { key:'ui.completeTitle',    label:'コンプリート タイトル' },
      { key:'ui.completeSubtitle', label:'コンプリート サブタイトル' },
      { key:'ui.completeTimeLabel',label:'クリアタイム ラベル' },
      { key:'ui.btnCompleteMap',   label:'「スタンプ一覧を見る」ボタン' },
    ]);
    renderGroup('te-coupon', [
      { key:'coupon.title', label:'クーポン タイトル' },
      { key:'coupon.body',  label:'クーポン 本文' },
      { key:'coupon.code',  label:'クーポン コード' },
    ]);
  }

  function renderGroup(cid, rows) {
    var c = document.getElementById(cid);
    if (!c) return;
    c.innerHTML = rows.map(function (r) {
      var keys = r.key.split('.'), obj = _cfg;
      keys.forEach(function (k) { obj = obj && obj[k]; });
      return '<div class="te-row"><label>' + UI.esc(r.label) + '</label>'
        + '<input type="text" class="admin-input te-input" data-key="' + r.key + '" value="' + UI.esc(String(obj || '')) + '"></div>';
    }).join('');
  }

  function collectTexts() {
    document.querySelectorAll('.te-input').forEach(function (el) {
      var keys = el.dataset.key.split('.'), obj = _cfg;
      for (var i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = el.value;
    });
  }

  function renderHowtoEditor() {
    var c = document.getElementById('howto-editor');
    if (!c) return;
    c.innerHTML = (_cfg.howtoSteps || []).map(function (s, i) {
      return '<div class="howto-edit-item" data-idx="' + i + '">'
        + '<div class="howto-edit-num">' + (i + 1) + '</div>'
        + '<div class="howto-edit-fields">'
        + '<input type="text" class="admin-input" placeholder="タイトル" value="' + UI.esc(s.title) + '" data-field="title" data-idx="' + i + '">'
        + '<input type="text" class="admin-input" placeholder="説明" value="' + UI.esc(s.desc) + '" data-field="desc" data-idx="' + i + '">'
        + '</div><button class="howto-del" data-idx="' + i + '">✕</button></div>';
    }).join('');
    c.querySelectorAll('input').forEach(function (el) {
      el.oninput = function () {
        var idx = parseInt(el.dataset.idx);
        if (_cfg.howtoSteps[idx]) _cfg.howtoSteps[idx][el.dataset.field] = el.value;
      };
    });
    c.querySelectorAll('.howto-del').forEach(function (b) {
      b.onclick = function () {
        _cfg.howtoSteps.splice(parseInt(b.dataset.idx), 1);
        renderHowtoEditor();
      };
    });
  }

  function openEdit(id) {
    var s = id ? ((_cfg.stamps || []).find(function (x) { return x.id === id; }) || {}) : {};
    var isNew = !s.id;
    document.getElementById('stamp-edit-title').textContent   = isNew ? 'スタンプ追加' : 'スタンプ編集';
    document.getElementById('stamp-edit-id').value            = s.id || '';
    document.getElementById('stamp-edit-name').value          = s.name || '';
    document.getElementById('stamp-edit-location').value      = s.location || '';
    document.getElementById('stamp-edit-message').value       = s.message || '';
    document.getElementById('stamp-edit-emoji').value         = s.emoji || '⭐';
    document.getElementById('stamp-edit-code').value          = s.code || '';
    document.getElementById('stamp-edit-model').value         = s.modelUrl || '';

    var sel = document.getElementById('stamp-edit-mind');
    sel.innerHTML = '<option value="">— .mindファイルを選択 —</option>'
      + (_cfg.mindFiles || []).map(function (f) {
          return '<option value="' + UI.esc(f.name) + '"' + (s.mindFile === f.name ? ' selected' : '') + '>' + UI.esc(f.name) + '</option>';
        }).join('');

    var delBtn = document.getElementById('btn-stamp-edit-delete');
    if (delBtn) delBtn.style.display = isNew ? 'none' : '';

    UI.showModal('modal-stamp-edit');
  }

  function saveEdit() {
    var id   = document.getElementById('stamp-edit-id').value;
    var name = document.getElementById('stamp-edit-name').value.trim();
    var loc  = document.getElementById('stamp-edit-location').value.trim();
    if (!name) { UI.toast('スタンプ名を入力してください'); return; }
    if (!loc)  { UI.toast('場所を入力してください'); return; }

    var selectedMind = document.getElementById('stamp-edit-mind').value;
    var mindFileData = '';
    if (selectedMind) {
      var mf = (_cfg.mindFiles || []).find(function (f) { return f.name === selectedMind; });
      if (mf) mindFileData = mf.data || '';
    }

    var data = {
      id:           id || ('s' + Date.now()),
      name:         name,
      location:     loc,
      message:      document.getElementById('stamp-edit-message').value,
      emoji:        document.getElementById('stamp-edit-emoji').value || '⭐',
      code:         document.getElementById('stamp-edit-code').value,
      modelUrl:     document.getElementById('stamp-edit-model').value,
      mindFile:     selectedMind,
      mindFileData: mindFileData,
    };

    var idx = id ? (_cfg.stamps || []).findIndex(function (s) { return s.id === id; }) : -1;
    if (idx >= 0) { _cfg.stamps[idx] = data; } else { _cfg.stamps.push(data); }

    Config.save().then(function () {
      renderAll();
      UI.hideModal('modal-stamp-edit');
      UI.toast('スタンプを保存しました ✓');
      AR.init(_cfg.stamps, App.onStampDetect);
      UI.updateProgress(_cfg.stamps);
    });
  }

  function deleteStamp(id) {
    if (!confirm('このスタンプを削除しますか？')) return;
    _cfg.stamps = (_cfg.stamps || []).filter(function (s) { return s.id !== id; });
    Config.save().then(function () {
      renderAll();
      UI.hideModal('modal-stamp-edit');
      UI.toast('削除しました');
      AR.init(_cfg.stamps, App.onStampDetect);
      UI.updateProgress(_cfg.stamps);
    });
  }

  function readMind(file) {
    var r = new FileReader();
    r.onload = function (e) {
      if (!_cfg.mindFiles) _cfg.mindFiles = [];
      // 同名ファイルは上書き
      var existing = _cfg.mindFiles.findIndex(function (f) { return f.name === file.name; });
      var entry = { name: file.name, data: e.target.result };
      if (existing >= 0) { _cfg.mindFiles[existing] = entry; }
      else { _cfg.mindFiles.push(entry); }
      Config.save().then(function () {
        renderMindList();
        UI.toast('.mindファイルを追加しました ✓');
      });
    };
    r.readAsDataURL(file);
  }

  function bindTabs() {
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.onclick = function () {
        document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-pane').forEach(function (p) {
          p.classList.remove('active'); p.style.display = 'none';
        });
        tab.classList.add('active');
        var pane = document.getElementById('tab-' + tab.dataset.tab);
        if (pane) { pane.classList.add('active'); pane.style.display = 'block'; }
      };
    });
  }

  function bindStatic() {
    // スタンプ管理
    B('btn-add-stamp', function () { openEdit(null); });
    B('btn-stamp-edit-close',  function () { UI.hideModal('modal-stamp-edit'); });
    B('modal-stamp-edit-bg',   function () { UI.hideModal('modal-stamp-edit'); });
    B('btn-stamp-edit-save',   saveEdit);
    B('btn-stamp-edit-delete', function () { deleteStamp(document.getElementById('stamp-edit-id').value); });

    // mindファイル
    var mi = document.getElementById('mind-file-input');
    var dz = document.getElementById('mind-drop-zone');
    if (dz) {
      dz.onclick    = function () { if (mi) mi.click(); };
      dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('drag-over'); };
      dz.ondragleave = function () { dz.classList.remove('drag-over'); };
      dz.ondrop = function (e) {
        e.preventDefault(); dz.classList.remove('drag-over');
        var f = e.dataTransfer.files[0];
        if (f && f.name.endsWith('.mind')) readMind(f);
        else UI.toast('.mindファイルのみ対応しています');
      };
    }
    if (mi) mi.onchange = function (e) { var f = e.target.files[0]; if (f) readMind(f); e.target.value = ''; };

    // 遊び方ステップ
    B('btn-add-howto-step', function () {
      _cfg.howtoSteps.push({ title: '新しいステップ', desc: '説明を入力してください' });
      renderHowtoEditor();
    });

    // 文言保存（Firebase即時反映込み）
    B('btn-save-texts', function () {
      collectTexts();
      Config.save().then(function () {
        UI.applyConfig(_cfg);
        UI.renderHowtoSteps(_cfg.howtoSteps);
        renderTextEditors(); // 入力値を反映した状態でリレンダー
        UI.toast(FirebaseManager.isConnected()
          ? '✅ 保存完了 — 参加者全員に即時反映されました'
          : '💾 ローカル保存完了（Firebase未接続）');
      });
    });

    // Firebase設定
    B('btn-save-firebase', function () {
      var fbCfg = {
        apiKey:      document.getElementById('fb-api-key').value.trim(),
        authDomain:  document.getElementById('fb-auth-domain').value.trim(),
        databaseURL: document.getElementById('fb-db-url').value.trim(),
        projectId:   document.getElementById('fb-project-id').value.trim(),
      };
      if (!fbCfg.apiKey || !fbCfg.databaseURL) {
        UI.toast('API KeyとDatabase URLは必須です'); return;
      }
      DB.set('firebaseConfig', fbCfg).then(function () {
        var ok = FirebaseManager.init(fbCfg);
        var statusEl = document.getElementById('firebase-status');
        if (ok) {
          if (statusEl) statusEl.textContent = '✅ 接続成功！保存すると参加者全員に即時反映されます';
          UI.toast('Firebase接続成功 🔥');
          // 接続後にリアルタイム監視開始
          FirebaseManager.watchConfig(function (remoteCfg) {
            _cfg = Config.deepMerge(_cfg, remoteCfg);
            Config.set(_cfg);
            UI.applyConfig(_cfg);
          });
        } else {
          if (statusEl) statusEl.textContent = '❌ 接続失敗 — 設定を確認してください';
          UI.toast('Firebase接続に失敗しました');
        }
      });
    });

    // バージョン管理
    B('btn-update-version', function () {
      var nv = document.getElementById('admin-version-id').value.trim();
      if (!nv) { UI.toast('バージョンIDを入力してください'); return; }
      if (!confirm('バージョンを「' + nv + '」に更新すると参加者全員の進捗がリセットされます。よろしいですか？')) return;
      _cfg.versionId = nv;
      Config.save().then(function () { return DB.set('versionId', nv); })
        .then(function () { return State.reset(); })
        .then(function () {
          UI.updateProgress(_cfg.stamps);
          UI.updateTimer(0);
          var vb = document.getElementById('admin-ver-badge');
          if (vb) vb.textContent = 'v: ' + nv;
          UI.toast('バージョンを更新しました ✓');
        });
    });

    // パスワード変更
    B('btn-change-pw', function () {
      var pw = document.getElementById('admin-new-pw').value.trim();
      if (!pw) { UI.toast('パスワードを入力してください'); return; }
      _cfg.adminPassword = pw;
      Config.save().then(function () {
        document.getElementById('admin-new-pw').value = '';
        UI.toast('パスワードを変更しました ✓');
      });
    });

    // 個人リセット
    B('btn-reset-self', function () {
      if (!confirm('この端末のスタンプ進捗をリセットしますか？\n他の参加者には影響しません。')) return;
      State.reset().then(function () {
        UI.updateProgress(_cfg.stamps);
        UI.updateTimer(0);
        var btn = document.getElementById('btn-go-scan');
        if (btn) {
          btn.innerHTML = '<span>📷</span><span id="ui-btn-scan">' + UI.esc(_cfg.ui.btnScan) + '</span>';
          btn.style.background = ''; btn.style.boxShadow = '';
          btn.classList.add('btn-glow');
        }
        UI.toast('この端末の進捗をリセットしました');
      });
    });

    // JSON入出力
    B('btn-export-json', function () {
      var toExport = JSON.parse(JSON.stringify(_cfg));
      // mindファイルのbase64データは除外（ファイルサイズが大きいため）
      if (toExport.mindFiles) {
        toExport.mindFiles = toExport.mindFiles.map(function (f) { return { name: f.name }; });
      }
      if (toExport.stamps) {
        toExport.stamps.forEach(function (s) { delete s.mindFileData; });
      }
      var blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'stamp-rally-' + _cfg.versionId + '.json';
      a.click();
    });

    var imp = document.getElementById('import-json-input');
    if (imp) {
      imp.onchange = function (e) {
        var f = e.target.files[0]; if (!f) return;
        var r = new FileReader();
        r.onload = function (ev) {
          try {
            var imported = JSON.parse(ev.target.result);
            _cfg = Config.deepMerge(_cfg, imported);
            Config.set(_cfg);
            Config.save().then(function () {
              renderAll();
              UI.applyConfig(_cfg);
              UI.updateProgress(_cfg.stamps);
              AR.init(_cfg.stamps, App.onStampDetect);
              UI.toast('インポートしました ✓');
            });
          } catch(err) { UI.toast('JSONの形式が正しくありません'); }
        };
        r.readAsText(f); e.target.value = '';
      };
    }

    // Firebase設定を保存済みなら復元して表示
    DB.get('firebaseConfig').then(function (fbCfg) {
      if (!fbCfg) return;
      var fields = { 'fb-api-key': fbCfg.apiKey, 'fb-auth-domain': fbCfg.authDomain, 'fb-db-url': fbCfg.databaseURL, 'fb-project-id': fbCfg.projectId };
      Object.keys(fields).forEach(function (id) {
        var el = document.getElementById(id); if (el && fields[id]) el.value = fields[id];
      });
      var statusEl = document.getElementById('firebase-status');
      if (FirebaseManager.isConnected() && statusEl) {
        statusEl.textContent = '✅ 接続済み';
      }
    });
  }

  return { init: init };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   10. App (メイン制御)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var App = {
  _cfg: null,

  onStampDetect: function (stamp) {
    var isNew = !State.isAcquired(stamp.id);
    if (!isNew) {
      AR.destroyScene();
      UI.showStampDetail(stamp, false);
      return;
    }
    State.acquireStamp(stamp.id).then(function () {
      AR.destroyScene();
      UI.showStampDetail(stamp, true);
      UI.updateProgress(App._cfg.stamps);
      var completed = (App._cfg.stamps.length > 0) && (State.getCount() >= App._cfg.stamps.length);
      if (completed) {
        State.setCompleted();
        setTimeout(function () {
          UI.showComplete(State.getElapsed());
          UI.applyCompletedMapFooter(App._cfg);
        }, 1400);
      }
    });
  },

  init: function () {
    Config.load().then(function (cfg) {
      App._cfg = cfg;
      return State.load().then(function () { return cfg; });
    }).then(function (cfg) {
      UI.applyConfig(cfg);
      UI.renderStars();
      UI.renderHowtoSteps(cfg.howtoSteps);
      UI.updateProgress(cfg.stamps);
      UI.updateTimer(State.getElapsed());
      if (State.isCompleted()) UI.applyCompletedMapFooter(cfg);
      AR.init(cfg.stamps, App.onStampDetect);
      Admin.init(cfg);
      App.bindNav();
      App.bindModals();

      // ローディング画面を消してタイトルを表示
      var loading = document.getElementById('screen-loading');
      if (loading) { loading.style.display = 'none'; loading.classList.remove('active'); }
      UI.showScreen('screen-title');
    }).catch(function (e) {
      console.error('Init error:', e);
      var loading = document.getElementById('screen-loading');
      if (loading) { loading.style.display = 'none'; loading.classList.remove('active'); }
      UI.showScreen('screen-title');
    });
  },

  bindNav: function () {
    var cfg = App._cfg;

    B('btn-start',        function () { UI.showModal('modal-start'); });
    B('btn-start-ok',     function () { UI.hideModal('modal-start'); UI.showScreen('screen-map'); State.startTimer(); });
    B('btn-start-cancel', function () { UI.hideModal('modal-start'); });
    B('modal-start-bg',   function () { UI.hideModal('modal-start'); });
    B('btn-howto',        function () { UI.showModal('modal-howto'); });
    B('btn-map-back',     function () { UI.showScreen('screen-title'); });

    B('btn-go-scan', function () {
      if (State.isCompleted()) { UI.showComplete(State.getElapsed()); }
      else { AR.startScene(); }
    });

    B('btn-ar-back', function () { AR.destroyScene(); UI.showScreen('screen-map'); });
    B('btn-ar-manual', function () {
      var inp = document.getElementById('manual-input');
      var err = document.getElementById('manual-err');
      if (inp) inp.value = ''; if (err) err.style.display = 'none';
      UI.showModal('modal-manual');
    });

    B('btn-stamp-back',   function () { UI.showScreen('screen-map'); });
    B('btn-complete-map', function () { UI.showScreen('screen-map'); });

    B('btn-admin-entry', function () {
      var pw = prompt('管理者パスワードを入力してください（初期: admin）');
      if (pw === null) return;
      if (pw === (cfg.adminPassword || 'admin')) { UI.showScreen('screen-admin'); }
      else { UI.toast('パスワードが違います'); }
    });
    B('btn-admin-back', function () { UI.showScreen('screen-title'); });
  },

  bindModals: function () {
    var cfg = App._cfg;

    B('modal-howto-bg',  function () { UI.hideModal('modal-howto'); });
    B('btn-howto-close', function () { UI.hideModal('modal-howto'); });
    B('btn-howto-ok',    function () { UI.hideModal('modal-howto'); });

    B('modal-manual-bg',   function () { UI.hideModal('modal-manual'); });
    B('btn-manual-close',  function () { UI.hideModal('modal-manual'); });
    B('btn-manual-submit', function () {
      var val   = (document.getElementById('manual-input').value || '').trim();
      var match = (cfg.stamps || []).find(function (s) { return s.code === val; });
      var err   = document.getElementById('manual-err');
      if (match) { UI.hideModal('modal-manual'); App.onStampDetect(match); }
      else { if (err) err.style.display = 'block'; }
    });
    var mi = document.getElementById('manual-input');
    if (mi) mi.onkeydown = function (e) { if (e.key === 'Enter') document.getElementById('btn-manual-submit').click(); };

    B('btn-use-coupon',         function () { UI.showModal('modal-coupon-confirm'); });
    B('modal-coupon-confirm-bg',    function () { UI.hideModal('modal-coupon-confirm'); });
    B('btn-coupon-confirm-cancel',  function () { UI.hideModal('modal-coupon-confirm'); });
    B('btn-coupon-confirm-ok', function () {
      UI.hideModal('modal-coupon-confirm');
      DB.set('couponUsed', true).then(function () {
        var card     = document.getElementById('coupon-card');
        var useArea  = document.getElementById('coupon-use-area');
        var usedArea = document.getElementById('coupon-used-area');
        if (card)     card.classList.add('used');
        if (useArea)  useArea.style.display  = 'none';
        if (usedArea) usedArea.style.display = 'block';
        UI.toast('クーポンを使用しました ✓');
      });
    });

    // マップ → スタンプタップ
    var sl = document.getElementById('stamp-list');
    if (sl) {
      sl.onclick = function (e) {
        var item = e.target.closest('.stamp-item');
        if (!item) return;
        var id    = item.dataset.id;
        var stamp = (cfg.stamps || []).find(function (s) { return s.id === id; });
        if (stamp && State.isAcquired(id)) UI.showStampDetail(stamp, false);
      };
    }
  },
};

function B(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PWA
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}

document.addEventListener('DOMContentLoaded', function () { App.init(); });
