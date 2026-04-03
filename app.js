'use strict';
/* ============================================================
   WebAR Stamp Rally — app.js  (全バグ修正版)
   ============================================================ */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. DB  (IndexedDB + localStorage fallback)
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
        var q = db.transaction('kv', 'readonly').objectStore('kv').get(k);
        q.onsuccess = function () { res(q.result !== undefined ? q.result : null); };
        q.onerror   = function () { rej(q.error); };
      });
    }).catch(function () {
      var v = localStorage.getItem('sr_' + k);
      return v ? JSON.parse(v) : null;
    });
  }

  function set(k, v) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res;
        tx.onerror    = function () { rej(tx.error); };
      });
    }).catch(function () {
      localStorage.setItem('sr_' + k, JSON.stringify(v));
    });
  }

  function del(k) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(k);
        tx.oncomplete = res;
        tx.onerror    = function () { rej(tx.error); };
      });
    }).catch(function () { localStorage.removeItem('sr_' + k); });
  }

  return { get: get, set: set, del: del };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. DEFAULT CONFIG
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var DEFAULT_CONFIG = {
  versionId: '2026_Ver1',
  adminPassword: 'admin',
  sheetsUrl: '',
  leaderboardUrl: '',
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
    arCameraFallback: '⌨️ ボタンで合言葉入力もできます',
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
    { title: 'アプリを開く',     desc: 'このページをホーム画面に追加しておくと便利です。' },
    { title: 'スタンプ場所へ行く', desc: 'マップから場所を確認して出発しましょう！' },
    { title: 'マーカーをスキャン', desc: '「ARスキャン開始」を押してカメラをマーカーに向けてください。' },
    { title: 'スタンプをゲット',  desc: 'スキャン成功！スタンプが記録されます。' },
    { title: 'コンプリートで特典', desc: '全スタンプを集めると特典クーポンが表示されます！' },
  ],
  stamps: [
    { id:'s01', name:'科学部の秘密実験', location:'3階 理科室', message:'サイエンスの世界へようこそ！', emoji:'🔬', code:'1234', barcodeId:0, modelUrl:'', mindFile:'' },
    { id:'s02', name:'美術部ギャラリー',  location:'2階 美術室', message:'芸術に触れてみよう！',         emoji:'🎨', code:'2345', barcodeId:1, modelUrl:'', mindFile:'' },
    { id:'s03', name:'音楽部ライブ',      location:'体育館',     message:'音楽の力を感じてください！',   emoji:'🎵', code:'3456', barcodeId:2, modelUrl:'', mindFile:'' },
    { id:'s04', name:'茶道部おもてなし',  location:'和室',       message:'お茶をどうぞ！',               emoji:'🍵', code:'4567', barcodeId:3, modelUrl:'', mindFile:'' },
    { id:'s05', name:'フードコート',       location:'中庭',       message:'美味しいものいっぱい！',         emoji:'🍔', code:'5678', barcodeId:4, modelUrl:'', mindFile:'' },
  ],
  mindFiles: [],
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. CONFIG
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var Config = (function () {
  var _cfg = null;

  function merge(t, s) {
    var o = Object.assign({}, t);
    Object.keys(s).forEach(function (k) {
      if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
        o[k] = merge(t[k] || {}, s[k]);
      } else {
        o[k] = s[k];
      }
    });
    return o;
  }

  function load() {
    return DB.get('config').then(function (cached) {
      _cfg = cached ? merge(DEFAULT_CONFIG, cached) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      return DB.get('versionId');
    }).then(function (sv) {
      if (sv && sv !== _cfg.versionId) {
        return Promise.all([DB.del('progress'), DB.del('timerBase'), DB.del('timerRunSince')]);
      }
    }).then(function () {
      return DB.set('versionId', _cfg.versionId);
    }).then(function () {
      if (_cfg.sheetsUrl) {
        return fetch(_cfg.sheetsUrl)
          .then(function (r) { return r.json(); })
          .then(function (d) { if (d && typeof d === 'object') { _cfg = merge(_cfg, d); return DB.set('config', _cfg); } })
          .catch(function (e) { console.warn('Sheets fetch failed:', e.message); });
      }
    }).then(function () { return _cfg; });
  }

  function save()             { return DB.set('config', _cfg); }
  function get()              { return _cfg; }
  function fetchSheets(url)   {
    return fetch(url).then(function (r) { return r.json(); })
      .then(function (d) { if (d && typeof d === 'object') { _cfg = merge(_cfg, d); return DB.set('config', _cfg); } });
  }

  return { load: load, get: get, save: save, fetchSheets: fetchSheets };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. STATE  (進捗 + タイマー)
   タイマー設計:
     timerBase    = 保存済み累積ms (DB永続)
     timerRunSince= 動作開始時刻   (DB永続、停止中はnull)
   リロード時: timerRunSinceが残っていれば差分をbaseに加算して即再開
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var State = (function () {
  var _acq     = {};
  var _base    = 0;
  var _runSince= null;
  var _running = false;
  var _iv      = null;
  var _completed = false; // コンプリート済みフラグ

  function load() {
    return Promise.all([
      DB.get('progress'),
      DB.get('timerBase'),
      DB.get('timerRunSince'),
      DB.get('completed'),
    ]).then(function (v) {
      if (v[0]) v[0].forEach(function (id) { _acq[id] = true; });
      _base    = v[1] || 0;
      _completed = !!v[3];

      if (v[2]) {
        // リロード前にタイマーが動いていた → 差分をbaseに加算して再開
        _base += (Date.now() - v[2]);
        DB.set('timerBase', _base);
        DB.del('timerRunSince');
        if (!_completed) {
          // コンプリート済みでなければ再開
          _runSince = Date.now();
          _running  = true;
          DB.set('timerRunSince', _runSince);
          _iv = setInterval(function () { UI.updateTimer(getElapsed()); }, 500);
        }
      }
    });
  }

  function startTimer() {
    if (_running || _completed) return;
    _running  = true;
    _runSince = Date.now();
    DB.set('timerRunSince', _runSince);
    _iv = setInterval(function () { UI.updateTimer(getElapsed()); }, 500);
  }

  function stopTimer() {
    if (!_running) return;
    _base += (Date.now() - _runSince);
    _running  = false;
    _runSince = null;
    clearInterval(_iv); _iv = null;
    DB.set('timerBase', _base);
    DB.del('timerRunSince');
  }

  function getElapsed() {
    return _running ? _base + (Date.now() - _runSince) : _base;
  }

  function acquireStamp(id) {
    if (_acq[id]) return Promise.resolve(false);
    _acq[id] = true;
    return DB.set('progress', Object.keys(_acq)).then(function () { return true; });
  }

  function isAcquired(id)  { return !!_acq[id]; }
  function getCount()      { return Object.keys(_acq).length; }
  function isCompleted()   { return _completed; }

  function setCompleted() {
    _completed = true;
    stopTimer();
    DB.set('completed', true);
  }

  function reset() {
    _acq       = {};
    _base      = 0;
    _runSince  = null;
    _running   = false;
    _completed = false;
    clearInterval(_iv); _iv = null;
    return Promise.all([
      DB.del('progress'),
      DB.del('timerBase'),
      DB.del('timerRunSince'),
      DB.del('completed'),
    ]);
  }

  return {
    load: load,
    startTimer: startTimer, stopTimer: stopTimer, getElapsed: getElapsed,
    acquireStamp: acquireStamp, isAcquired: isAcquired, getCount: getCount,
    isCompleted: isCompleted, setCompleted: setCompleted,
    reset: reset,
  };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. UI
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var UI = (function () {
  var _toastTimer = null;

  /* --- 画面切り替え: display:flex / display:none --- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.style.display = 'none'; s.classList.remove('active'); });
    var el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
  }

  /* --- モーダル --- */
  function showModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'flex'; }
  function hideModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

  /* --- Toast（エラーではなく通知のみ） --- */
  function toast(msg, dur) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { el.style.display = 'none'; }, dur || 2500);
  }

  /* --- Time format --- */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function fmtTime(ms) {
    var t = Math.floor(ms / 1000);
    return pad(Math.floor(t / 60)) + ':' + pad(t % 60);
  }
  function updateTimer(ms) {
    var el = document.getElementById('timer-display');
    if (el) el.textContent = fmtTime(ms);
  }

  /* --- HTML escape --- */
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* --- Config を DOM に反映 --- */
  function applyConfig(cfg) {
    function st(id, v) { var el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; }
    st('ui-event-year',      cfg.eventYear);
    st('ui-event-title',     cfg.eventTitle);
    st('ui-event-subtitle',  cfg.eventSubtitle);
    st('ui-btn-start',       cfg.ui.btnStart);
    st('ui-btn-howto',       cfg.ui.btnHowto);
    st('ui-howto-title',     cfg.ui.howtoTitle);
    st('ui-map-title',       cfg.ui.mapTitle);
    st('ui-progress-label',  cfg.ui.progressLabel);
    st('ui-btn-scan',        cfg.ui.btnScan);
    st('ui-ar-title',        cfg.ui.arTitle);
    st('ui-ar-hint',         cfg.ui.arHint);
    st('ui-manual-title',    cfg.ui.manualTitle);
    st('ui-manual-desc',     cfg.ui.manualDesc);
    st('ui-complete-title',  cfg.ui.completeTitle);
    st('ui-complete-subtitle', cfg.ui.completeSubtitle);
    st('ui-complete-time-label', cfg.ui.completeTimeLabel);
    st('btn-complete-map',   cfg.ui.btnCompleteMap);
    st('ui-coupon-title',    cfg.coupon.title);
    st('ui-coupon-body',     cfg.coupon.body);
    st('ui-coupon-code',     cfg.coupon.code);
    // スタート確認ポップアップ
    var pt = document.querySelector('.popup-title');
    if (pt) pt.textContent = cfg.startConfirmTitle || 'スタートしますか？';
    var pd = document.querySelector('.popup-desc');
    if (pd) pd.textContent = cfg.startConfirmDesc  || '準備ができたらスタートしてください。';
    var pok = document.getElementById('btn-start-ok');
    if (pok) { var sp = pok.querySelector('span:last-child'); if (sp) sp.textContent = cfg.startConfirmOk || 'スタート！'; }
    var pca = document.getElementById('btn-start-cancel');
    if (pca) pca.textContent = cfg.startConfirmCancel || 'キャンセル';
    document.title = cfg.eventTitle.replace('\n', '') + ' ' + cfg.eventYear;
  }

  /* --- 遊び方ステップ --- */
  function renderHowtoSteps(steps) {
    var c = document.getElementById('howto-steps');
    if (!c) return;
    c.innerHTML = steps.map(function (s, i) {
      return '<div class="howto-step"><div class="howto-step-num">' + (i + 1) + '</div>'
        + '<div class="howto-step-body"><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div></div>';
    }).join('');
  }

  /* --- スタンプ一覧（マップ画面） --- */
  function renderStampList(stamps) {
    var list = document.getElementById('stamp-list');
    if (!list) return;
    list.innerHTML = stamps.map(function (s) {
      var acq = State.isAcquired(s.id);
      return '<div class="stamp-item' + (acq ? ' acquired' : '') + '" data-id="' + s.id + '">'
        + '<div class="s-emoji">' + (s.emoji || '⭐') + '</div>'
        + '<div class="s-info"><div class="s-name">' + esc(s.name) + '</div>'
        + '<div class="s-loc">📍 ' + esc(s.location) + '</div></div>'
        + '<div class="s-check">' + (acq ? '✓' : '') + '</div>'
        + '</div>';
    }).join('');
  }

  function updateProgress(stamps) {
    var total = stamps.length, count = State.getCount();
    var pct   = total ? Math.round(count / total * 100) : 0;
    var bar   = document.getElementById('progress-bar');
    if (bar) bar.style.width = pct + '%';
    var lbl = document.getElementById('progress-count');
    if (lbl) lbl.textContent = count + ' / ' + total;
    renderStampList(stamps);
  }

  /* --- コンプリート後のマップフッターを変更 --- */
  function applyCompletedMapFooter(cfg) {
    var btn = document.getElementById('btn-go-scan');
    if (!btn) return;
    btn.innerHTML = '<span>🏆</span><span>' + esc(cfg.ui.btnCompleteMap || 'コンプリート画面へ') + '</span>';
    btn.classList.remove('btn-glow');
    btn.style.background = 'linear-gradient(135deg, #ffce00, #ff8c00)';
    btn.style.boxShadow  = '0 4px 22px rgba(255,206,0,.35)';
  }

  /* --- スタンプ詳細画面表示（新規取得 / 獲得済みタップ共用） --- */
  function showStampDetail(stamp, isNew) {
    document.getElementById('sa-emoji').textContent    = stamp.emoji || '⭐';
    document.getElementById('sa-name').textContent     = stamp.name;
    document.getElementById('sa-location').textContent = stamp.location;
    document.getElementById('sa-message').textContent  = stamp.message;

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

    // スパークルは新規取得時のみ
    if (isNew) {
      var c = document.getElementById('sparkles-container');
      if (c) {
        c.innerHTML = '';
        var cols = ['#c840ff', '#00f0ff', '#ffce00', '#00e87a'];
        for (var i = 0; i < 22; i++) {
          var d   = document.createElement('div');
          d.className = 'sparkle';
          var sz  = 5 + Math.random() * 8;
          var tx  = (Math.random() - 0.5) * 200;
          var ty  = -(40 + Math.random() * 120);
          d.style.cssText = 'left:' + Math.random() * 100 + '%;top:' + (50 + Math.random() * 40) + '%;'
            + 'width:' + sz + 'px;height:' + sz + 'px;'
            + 'background:' + cols[i % 4] + ';'
            + '--tx:' + tx + 'px;--ty:' + ty + 'px;'
            + '--d:' + (1 + Math.random()) + 's;--dl:' + (Math.random() * 0.4) + 's;';
          c.appendChild(d);
        }
      }
    }
  }

  /* --- コンプリート画面 --- */
  function showComplete(elapsed) {
    document.getElementById('complete-time-value').textContent = fmtTime(elapsed);
    showScreen('screen-complete');
    // confetti: fixed配置のcanvasで全画面
    var canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    var ctx    = canvas.getContext('2d');
    var cols   = ['#c840ff', '#00f0ff', '#ffce00', '#00e87a', '#ff4458', '#fff'];
    var pp     = [];
    for (var i = 0; i < 140; i++) {
      pp.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        r: 4 + Math.random() * 7,
        c: cols[i % 6],
        sp: 2 + Math.random() * 3.5,
        dr: (Math.random() - 0.5) * 1.5,
        a: Math.random() * Math.PI * 2,
        sa: (Math.random() - 0.5) * 0.15,
      });
    }
    var fr;
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pp.forEach(function (p) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.8);
        ctx.restore();
        p.y += p.sp; p.x += p.dr; p.a += p.sa;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      fr = requestAnimationFrame(draw);
    }());
    setTimeout(function () { cancelAnimationFrame(fr); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 9000);
  }

  /* --- 星 --- */
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
   6. AR  (A-Frameを動的ロード / destroyで完全クリーン)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var AR = (function () {
  var _stamps   = [];
  var _onDetect = null;
  var _cd       = {};   // cooldown: id → timestamp

  function init(stamps, onDetect) { _stamps = stamps; _onDetect = onDetect; }

  function startScene() {
    // AR画面を表示
    UI.showScreen('screen-ar');

    var wrapper = document.getElementById('ar-scene-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    function build() {
      var html = _stamps.map(function (s) {
        var obj = s.modelUrl
          ? '<a-gltf-model src="' + s.modelUrl + '" scale="0.12 0.12 0.12"></a-gltf-model>'
          : '<a-box color="#c840ff" scale="0.5 0.5 0.5"></a-box>'
            + '<a-text value="' + (s.emoji || '★') + '" align="center" position="0 0.7 0" scale="3 3 3"></a-text>';
        return s.mindFile
          ? '<a-nft id="mk-' + s.id + '" type="nft" url="' + s.mindFile + '" smooth="true" smoothCount="10">' + obj + '</a-nft>'
          : '<a-marker id="mk-' + s.id + '" type="barcode" value="' + s.barcodeId + '" smooth="true" smoothCount="10">' + obj + '</a-marker>';
      }).join('');

      wrapper.innerHTML =
        '<a-scene embedded '
        + 'arjs="sourceType:webcam;debugUIEnabled:false;detectionMode:mono_and_matrix;matrixCodeType:3x3_hamming63;" '
        + 'vr-mode-ui="enabled:false" '
        + 'renderer="logarithmicDepthBuffer:true;antialias:true;" '
        + 'style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;">'
        + html
        + '<a-entity camera></a-entity>'
        + '</a-scene>';

      var scene = wrapper.querySelector('a-scene');

      function attachEvents() {
        _stamps.forEach(function (s) {
          var mk = document.getElementById('mk-' + s.id);
          if (mk) mk.addEventListener('markerFound', function () { handleDetect(s); });
        });
      }
      if (scene && scene.hasLoaded) { attachEvents(); }
      else if (scene) { scene.addEventListener('loaded', attachEvents); }

      // カメラ状態表示
      var msgEl = document.getElementById('ar-msg');
      if (msgEl) {
        var cfg = Config.get();
        msgEl.textContent = (cfg && cfg.ui.arCameraMsg) || 'カメラ起動中...';
        var obs = new MutationObserver(function () {
          var video = document.querySelector('video');
          if (video) { msgEl.textContent = ''; obs.disconnect(); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () {
          if (msgEl.textContent !== '') {
            msgEl.textContent = (cfg && cfg.ui.arCameraFallback) || '⌨️ ボタンで合言葉入力もできます';
          }
        }, 8000);
      }
    }

    if (typeof AFRAME === 'undefined') {
      var s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/aframe/1.4.2/aframe.min.js';
      s1.onload = function () {
        var s2 = document.createElement('script');
        s2.src = 'https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js';
        s2.onload = build;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    } else {
      build();
    }
  }

  function destroyScene() {
    // A-Frameが生成したvideoなどを完全削除
    var wrapper = document.getElementById('ar-scene-wrapper');
    if (wrapper) wrapper.innerHTML = '';

    // bodyに残ったvideo/canvasタグも削除
    document.querySelectorAll('video').forEach(function (v) {
      v.srcObject = null;
      v.remove();
    });
    document.querySelectorAll('.a-canvas').forEach(function (c) { c.remove(); });

    _cd = {};
  }

  function handleDetect(stamp) {
    var now = Date.now();
    if (_cd[stamp.id] && now - _cd[stamp.id] < 4000) return;
    _cd[stamp.id] = now;

    // バナー表示
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
   7. DRAG & DROP（タッチ対応）
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function makeDraggable(listEl, onReorder) {
  var src = null, ghost = null, touchItem = null;

  function items()     { return Array.from(listEl.querySelectorAll('.stamp-admin-item')); }
  function idxOf(el)   { return items().indexOf(el); }
  function itemAtY(y)  { return items().find(function (i) { var r = i.getBoundingClientRect(); return y >= r.top && y <= r.bottom; }) || null; }
  function cleanup()   { items().forEach(function (i) { i.classList.remove('dragging', 'drag-over'); }); src = null; }

  function rebind() {
    items().forEach(function (item) {
      // Mouse drag
      item.setAttribute('draggable', 'true');
      item.ondragstart = function () { src = item; item.classList.add('dragging'); };
      item.ondragover  = function (e) { e.preventDefault(); items().forEach(function (i) { i.classList.remove('drag-over'); }); item.classList.add('drag-over'); };
      item.ondrop      = function (e) { e.preventDefault(); var si = idxOf(src), di = idxOf(item); if (src && si !== di) onReorder(si, di); cleanup(); };
      item.ondragend   = cleanup;

      // Touch drag (handle only)
      var handle = item.querySelector('.drag-icon');
      if (!handle) return;
      handle.ontouchstart = function (e) {
        touchItem = item; item.classList.add('dragging');
        ghost = item.cloneNode(true);
        var r = item.getBoundingClientRect();
        ghost.style.cssText = 'position:fixed;z-index:9999;left:' + r.left + 'px;top:' + r.top + 'px;width:' + item.offsetWidth + 'px;opacity:.85;pointer-events:none;background:var(--surf2);border:1.5px solid var(--accent);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
        document.body.appendChild(ghost);
        e.preventDefault();
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
      var t    = e.changedTouches[0];
      var over = itemAtY(t.clientY);
      var si   = idxOf(touchItem), di = over ? idxOf(over) : -1;
      if (over && si !== di && di >= 0) onReorder(si, di);
      ghost.remove(); ghost = null;
      items().forEach(function (i) { i.classList.remove('dragging', 'drag-over'); });
      touchItem = null;
    };
  }

  return { rebind: rebind };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   8. ADMIN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var Admin = (function () {
  var _cfg  = null;
  var _drag = null;

  function init(cfg) { _cfg = cfg; renderAll(); bindStatic(); }

  function renderAll() {
    renderStampList_();
    renderMindList();
    renderTextEditors();
    renderHowtoEditor();
    var vb = document.getElementById('admin-ver-badge');
    if (vb) vb.textContent = 'v: ' + _cfg.versionId;
    var vi = document.getElementById('admin-version-id');
    if (vi) vi.value = _cfg.versionId;
    var su = document.getElementById('admin-sheets-url');
    if (su) su.value = _cfg.sheetsUrl || '';
    var lu = document.getElementById('admin-leaderboard-url');
    if (lu) lu.value = _cfg.leaderboardUrl || '';
  }

  /* --- スタンプ管理リスト --- */
  function renderStampList_() {
    var list = document.getElementById('stamp-admin-list');
    if (!list) return;
    list.innerHTML = _cfg.stamps.map(function (s, i) {
      return '<div class="stamp-admin-item" data-idx="' + i + '">'
        + '<span class="drag-icon">☰</span>'
        + '<span class="sa-emoji">' + (s.emoji || '⭐') + '</span>'
        + '<div class="sa-info"><div class="sa-name">' + UI.esc(s.name) + '</div>'
        + '<div class="sa-sub">' + (s.mindFile ? '.mind: ' + s.mindFile : 'バーコード #' + s.barcodeId) + ' | 合言葉: ' + s.code + '</div></div>'
        + '<button class="sa-edit-btn" data-id="' + s.id + '">編集</button>'
        + '</div>';
    }).join('');

    list.querySelectorAll('.sa-edit-btn').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openEdit(b.dataset.id); };
    });

    if (!_drag) {
      _drag = makeDraggable(list, function (si, di) {
        var a = _cfg.stamps.slice();
        var m = a.splice(si, 1)[0];
        a.splice(di, 0, m);
        _cfg.stamps = a;
        Config.save();
        renderStampList_();
        UI.updateProgress(_cfg.stamps);
        UI.toast('並び順を更新しました ✓');
      });
    }
    _drag.rebind();
  }

  /* --- .mindファイルリスト --- */
  function renderMindList() {
    var list = document.getElementById('mind-file-list');
    if (!list) return;
    var files = _cfg.mindFiles || [];
    if (!files.length) {
      list.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:8px 0;">登録ファイルなし</p>';
      return;
    }
    list.innerHTML = files.map(function (f, i) {
      var linked = _cfg.stamps.find(function (s) { return s.mindFile === f.name; });
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
        _cfg.stamps.forEach(function (s) { if (s.mindFile === name) s.mindFile = ''; });
        Config.save(); renderMindList(); renderStampList_();
        UI.toast('削除しました');
      };
    });
  }

  /* --- 文言エディタ --- */
  function renderTextEditors() {
    renderGroup('te-event', [
      { key: 'eventYear',     label: '年度（バッジに表示）' },
      { key: 'eventTitle',    label: 'タイトル（改行は\\nと入力）' },
      { key: 'eventSubtitle', label: 'サブタイトル' },
    ]);
    renderGroup('te-start', [
      { key: 'startConfirmTitle',  label: '確認ダイアログ タイトル' },
      { key: 'startConfirmDesc',   label: '確認ダイアログ 説明文' },
      { key: 'startConfirmOk',     label: '「スタート！」ボタン' },
      { key: 'startConfirmCancel', label: '「キャンセル」ボタン' },
      { key: 'ui.btnStart',        label: 'タイトル画面「スタート！」ボタン' },
      { key: 'ui.btnHowto',        label: 'タイトル画面「遊び方」ボタン' },
    ]);
    renderGroup('te-map', [
      { key: 'ui.mapTitle',      label: 'マップ画面 タイトル' },
      { key: 'ui.progressLabel', label: '進捗ラベル' },
      { key: 'ui.btnScan',       label: '「ARスキャン開始」ボタン' },
    ]);
    renderGroup('te-ar', [
      { key: 'ui.arTitle',          label: 'ARスキャン画面 タイトル' },
      { key: 'ui.arHint',           label: 'スキャンヒント文' },
      { key: 'ui.arCameraMsg',      label: 'カメラ起動中メッセージ' },
      { key: 'ui.arCameraFallback', label: 'カメラ失敗時メッセージ' },
    ]);
    renderGroup('te-stamp', [
      { key: 'ui.stampNewTag',    label: 'スタンプ新規獲得 タグ' },
      { key: 'ui.stampAlreadyTag',label: 'スタンプ獲得済み タグ' },
      { key: 'ui.btnStampBack',   label: 'スタンプ画面「マップに戻る」ボタン' },
      { key: 'ui.manualTitle',    label: '合言葉モーダル タイトル' },
      { key: 'ui.manualDesc',     label: '合言葉モーダル 説明文' },
    ]);
    renderGroup('te-complete', [
      { key: 'ui.completeTitle',      label: 'コンプリート タイトル' },
      { key: 'ui.completeSubtitle',   label: 'コンプリート サブタイトル' },
      { key: 'ui.completeTimeLabel',  label: 'クリアタイム ラベル' },
      { key: 'ui.btnCompleteMap',     label: '「スタンプ一覧を見る」ボタン' },
    ]);
    renderGroup('te-coupon', [
      { key: 'coupon.title', label: 'クーポン タイトル' },
      { key: 'coupon.body',  label: 'クーポン 本文' },
      { key: 'coupon.code',  label: 'クーポン コード' },
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

  /* --- 遊び方エディタ --- */
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
      b.onclick = function () { _cfg.howtoSteps.splice(parseInt(b.dataset.idx), 1); renderHowtoEditor(); };
    });
  }

  /* --- スタンプ編集モーダル --- */
  function openEdit(id) {
    var s    = id ? (_cfg.stamps.find(function (x) { return x.id === id; }) || {}) : {};
    var isNew = !s.id;
    document.getElementById('stamp-edit-title').textContent     = isNew ? 'スタンプ追加' : 'スタンプ編集';
    document.getElementById('stamp-edit-id').value              = s.id || '';
    document.getElementById('stamp-edit-name').value            = s.name || '';
    document.getElementById('stamp-edit-location').value        = s.location || '';
    document.getElementById('stamp-edit-message').value         = s.message || '';
    document.getElementById('stamp-edit-emoji').value           = s.emoji || '⭐';
    document.getElementById('stamp-edit-code').value            = s.code || '';
    document.getElementById('stamp-edit-model').value           = s.modelUrl || '';
    document.getElementById('stamp-edit-barcode').value         = s.barcodeId !== undefined ? s.barcodeId : '';
    var sel = document.getElementById('stamp-edit-mind');
    sel.innerHTML = '<option value="">バーコードを使用（.mindなし）</option>'
      + (_cfg.mindFiles || []).map(function (f) {
        return '<option value="' + UI.esc(f.name) + '"' + (s.mindFile === f.name ? ' selected' : '') + '>' + UI.esc(f.name) + '</option>';
      }).join('');
    document.getElementById('btn-stamp-edit-delete').style.display = isNew ? 'none' : '';
    UI.showModal('modal-stamp-edit');
  }

  function saveEdit() {
    var id   = document.getElementById('stamp-edit-id').value;
    var name = document.getElementById('stamp-edit-name').value.trim();
    var loc  = document.getElementById('stamp-edit-location').value.trim();
    if (!name) { UI.toast('スタンプ名を入力してください'); return; }
    if (!loc)  { UI.toast('場所を入力してください');       return; }
    var data = {
      id:        id || ('s' + Date.now()),
      name:      name,
      location:  loc,
      message:   document.getElementById('stamp-edit-message').value,
      emoji:     document.getElementById('stamp-edit-emoji').value || '⭐',
      code:      document.getElementById('stamp-edit-code').value,
      modelUrl:  document.getElementById('stamp-edit-model').value,
      barcodeId: parseInt(document.getElementById('stamp-edit-barcode').value) || 0,
      mindFile:  document.getElementById('stamp-edit-mind').value,
    };
    var idx = id ? _cfg.stamps.findIndex(function (s) { return s.id === id; }) : -1;
    if (idx >= 0) { _cfg.stamps[idx] = data; } else { _cfg.stamps.push(data); }
    Config.save();
    renderAll();
    UI.hideModal('modal-stamp-edit');
    UI.toast('スタンプを保存しました ✓');
    AR.init(_cfg.stamps, App.onStampDetect);
    UI.updateProgress(_cfg.stamps);
  }

  function deleteStamp(id) {
    if (!confirm('このスタンプを削除しますか？')) return;
    _cfg.stamps = _cfg.stamps.filter(function (s) { return s.id !== id; });
    Config.save(); renderAll(); UI.hideModal('modal-stamp-edit');
    UI.toast('削除しました');
    AR.init(_cfg.stamps, App.onStampDetect);
    UI.updateProgress(_cfg.stamps);
  }

  function readMind(file) {
    var r = new FileReader();
    r.onload = function (e) {
      if (!_cfg.mindFiles) _cfg.mindFiles = [];
      _cfg.mindFiles.push({ name: file.name, data: e.target.result });
      Config.save(); renderMindList();
      UI.toast('.mindファイルを追加しました ✓');
    };
    r.readAsDataURL(file);
  }

  function showLeaderboard() {
    if (!_cfg.leaderboardUrl) { UI.toast('ランキングURLが設定されていません'); return; }
    var list = document.getElementById('lb-list');
    if (list) list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:24px">読み込み中...</p>';
    UI.showModal('modal-leaderboard');
    fetch(_cfg.leaderboardUrl + '?version=' + encodeURIComponent(_cfg.versionId))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var medals = ['r1', 'r2', 'r3'];
        list.innerHTML = (d.entries && d.entries.length)
          ? d.entries.map(function (e, i) {
              return '<div class="lb-item"><div class="lb-rank ' + (medals[i] || '') + '">' + (i + 1) + '</div>'
                + '<div class="lb-name">' + UI.esc(e.name) + '</div>'
                + '<div class="lb-time">' + UI.fmtTime(e.time) + '</div></div>';
            }).join('')
          : '<p style="text-align:center;color:var(--muted);padding:24px">記録なし</p>';
      })
      .catch(function () {
        if (list) list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:24px">読み込みに失敗しました</p>';
      });
  }

  /* --- イベント登録 --- */
  function bindStatic() {
    // タブ切り替え
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.onclick = function () {
        document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-pane').forEach(function (p) { p.classList.remove('active'); p.style.display = 'none'; });
        tab.classList.add('active');
        var pane = document.getElementById('tab-' + tab.dataset.tab);
        if (pane) { pane.classList.add('active'); pane.style.display = 'block'; }
      };
    });

    B('btn-add-stamp', function () { openEdit(null); });
    B('btn-stamp-edit-close',    function () { UI.hideModal('modal-stamp-edit'); });
    B('modal-stamp-edit-bg',     function () { UI.hideModal('modal-stamp-edit'); });
    B('btn-stamp-edit-save',     saveEdit);
    B('btn-stamp-edit-delete',   function () { deleteStamp(document.getElementById('stamp-edit-id').value); });

    var mi  = document.getElementById('mind-file-input');
    var dz  = document.getElementById('mind-drop-zone');
    if (dz) {
      dz.onclick = function () { if (mi) mi.click(); };
      dz.ondragover  = function (e) { e.preventDefault(); dz.classList.add('drag-over'); };
      dz.ondragleave = function () { dz.classList.remove('drag-over'); };
      dz.ondrop = function (e) {
        e.preventDefault(); dz.classList.remove('drag-over');
        var f = e.dataTransfer.files[0];
        if (f && f.name.endsWith('.mind')) readMind(f); else UI.toast('.mindファイルのみ対応しています');
      };
    }
    if (mi) mi.onchange = function (e) { var f = e.target.files[0]; if (f) readMind(f); e.target.value = ''; };

    B('btn-add-howto-step', function () {
      _cfg.howtoSteps.push({ title: '新しいステップ', desc: '説明を入力してください' });
      renderHowtoEditor();
    });

    B('btn-save-texts', function () {
      collectTexts();
      Config.save();
      UI.applyConfig(_cfg);
      UI.renderHowtoSteps(_cfg.howtoSteps);
      UI.toast('文言を保存しました ✓');
    });

    B('btn-update-version', function () {
      var nv = document.getElementById('admin-version-id').value.trim();
      if (!nv) { UI.toast('バージョンIDを入力してください'); return; }
      if (!confirm('バージョンを「' + nv + '」に更新すると参加者全員の進捗がリセットされます。よろしいですか？')) return;
      _cfg.versionId = nv;
      Config.save()
        .then(function () { return DB.set('versionId', nv); })
        .then(function () { return State.reset(); })
        .then(function () {
          UI.updateProgress(_cfg.stamps);
          UI.updateTimer(0);
          var vb = document.getElementById('admin-ver-badge');
          if (vb) vb.textContent = 'v: ' + nv;
          UI.toast('バージョンを更新しました ✓');
        });
    });

    // 個人リセット
    B('btn-reset-self', function () {
      if (!confirm('この端末のスタンプ進捗をリセットしますか？\n他の参加者には影響しません。')) return;
      State.reset().then(function () {
        UI.updateProgress(_cfg.stamps);
        UI.updateTimer(0);
        // マップフッターを元に戻す
        var btn = document.getElementById('btn-go-scan');
        if (btn) {
          btn.innerHTML = '<span>📷</span><span id="ui-btn-scan">' + UI.esc(_cfg.ui.btnScan) + '</span>';
          btn.style.background = '';
          btn.style.boxShadow  = '';
          btn.classList.add('btn-glow');
        }
        UI.toast('この端末の進捗をリセットしました');
      });
    });

    B('btn-fetch-sheets', function () {
      var url = document.getElementById('admin-sheets-url').value.trim();
      var st  = document.getElementById('sheets-status');
      if (!url) { UI.toast('URLを入力してください'); return; }
      _cfg.sheetsUrl = url;
      if (st) st.textContent = '取得中...';
      Config.fetchSheets(url)
        .then(function () {
          Config.save(); renderAll();
          UI.applyConfig(_cfg); UI.updateProgress(_cfg.stamps);
          if (st) st.textContent = '✓ 取得成功';
          UI.toast('読み込みました ✓');
        })
        .catch(function (e) {
          if (st) st.textContent = '✗ 失敗: ' + e.message;
          UI.toast('取得に失敗しました');
        });
    });

    B('btn-view-leaderboard', function () {
      _cfg.leaderboardUrl = document.getElementById('admin-leaderboard-url').value.trim();
      Config.save(); showLeaderboard();
    });
    B('btn-lb-close',    function () { UI.hideModal('modal-leaderboard'); });
    B('modal-lb-bg',     function () { UI.hideModal('modal-leaderboard'); });

    B('btn-export-json', function () {
      var blob = new Blob([JSON.stringify(_cfg, null, 2)], { type: 'application/json' });
      var a    = document.createElement('a');
      a.href   = URL.createObjectURL(blob);
      a.download = 'stamp-rally-' + _cfg.versionId + '.json';
      a.click();
    });

    var imp = document.getElementById('import-json-input');
    if (imp) {
      imp.onchange = function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function (ev) {
          try {
            Object.assign(_cfg, JSON.parse(ev.target.result));
            Config.save(); renderAll();
            UI.applyConfig(_cfg); UI.updateProgress(_cfg.stamps);
            AR.init(_cfg.stamps, App.onStampDetect);
            UI.toast('インポートしました ✓');
          } catch (err) {
            UI.toast('JSONの形式が正しくありません');
          }
        };
        r.readAsText(f);
        e.target.value = '';
      };
    }
  }

  return { init: init };
}());

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   9. APP  (メインコントローラー)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var App = {
  _cfg: null,
  _curStamp: null,

  /* スタンプ検出コールバック */
  onStampDetect: function (stamp) {
    var isNew = !State.isAcquired(stamp.id);

    if (!isNew) {
      // 獲得済み → 獲得済み画面を表示（ARを閉じてから）
      AR.destroyScene();
      App._curStamp = stamp;
      UI.showStampDetail(stamp, false);
      return;
    }

    // 新規取得
    State.acquireStamp(stamp.id).then(function () {
      AR.destroyScene();
      App._curStamp = stamp;
      UI.showStampDetail(stamp, true);
      UI.updateProgress(App._cfg.stamps);

      // コンプリート判定
      if (State.getCount() >= App._cfg.stamps.length) {
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

      // コンプリート済みならマップボタンを変更
      if (State.isCompleted()) {
        UI.applyCompletedMapFooter(cfg);
      }

      AR.init(cfg.stamps, App.onStampDetect);
      Admin.init(cfg);
      App.bindNav();
      App.bindModals();

      UI.showScreen('screen-title');
    }).catch(function (e) {
      console.error('Init error:', e);
      UI.showScreen('screen-title');
    });
  },

  bindNav: function () {
    var cfg = App._cfg;

    // スタート → 確認ポップアップ
    B('btn-start', function () { UI.showModal('modal-start'); });
    B('btn-start-ok', function () {
      UI.hideModal('modal-start');
      UI.showScreen('screen-map');
      State.startTimer();
    });
    B('btn-start-cancel', function () { UI.hideModal('modal-start'); });
    B('modal-start-bg',   function () { UI.hideModal('modal-start'); });

    B('btn-howto', function () { UI.showModal('modal-howto'); });

    // マップの戻るボタン
    B('btn-map-back', function () {
      UI.showScreen('screen-title');
    });

    // ARスキャン / コンプリート後はコンプリート画面へ
    B('btn-go-scan', function () {
      if (State.isCompleted()) {
        UI.showComplete(State.getElapsed());
      } else {
        AR.startScene();
      }
    });

    B('btn-ar-back', function () {
      AR.destroyScene();
      UI.showScreen('screen-map');
    });

    B('btn-ar-manual', function () {
      var inp = document.getElementById('manual-input');
      var err = document.getElementById('manual-err');
      if (inp) inp.value = '';
      if (err) err.style.display = 'none';
      UI.showModal('modal-manual');
    });

    // スタンプ詳細 → マップへ
    B('btn-stamp-back', function () { UI.showScreen('screen-map'); });

    // コンプリート画面 → マップへ（やり直し不可）
    B('btn-complete-map', function () { UI.showScreen('screen-map'); });

    // 管理者
    B('btn-admin-entry', function () {
      var pw = prompt('管理者パスワードを入力してください（初期: admin）');
      if (pw === (cfg.adminPassword || 'admin')) {
        UI.showScreen('screen-admin');
      } else if (pw !== null) {
        UI.toast('パスワードが違います');
      }
    });

    B('btn-admin-back', function () { UI.showScreen('screen-title'); });
  },

  bindModals: function () {
    var cfg = App._cfg;

    // 遊び方
    B('modal-howto-bg',   function () { UI.hideModal('modal-howto'); });
    B('btn-howto-close',  function () { UI.hideModal('modal-howto'); });
    B('btn-howto-ok',     function () { UI.hideModal('modal-howto'); });

    // 合言葉
    B('modal-manual-bg',  function () { UI.hideModal('modal-manual'); });
    B('btn-manual-close', function () { UI.hideModal('modal-manual'); });
    B('btn-manual-submit', function () {
      var val   = (document.getElementById('manual-input').value || '').trim();
      var match = cfg.stamps.find(function (s) { return s.code === val; });
      var err   = document.getElementById('manual-err');
      if (match) {
        UI.hideModal('modal-manual');
        App.onStampDetect(match);
      } else {
        if (err) err.style.display = 'block';
      }
    });

    var mi = document.getElementById('manual-input');
    if (mi) {
      mi.onkeydown = function (e) {
        if (e.key === 'Enter') { document.getElementById('btn-manual-submit').click(); }
      };
    }

    // マップ スタンプリストをタップ → 詳細表示
    var sl = document.getElementById('stamp-list');
    if (sl) {
      sl.onclick = function (e) {
        var item = e.target.closest('.stamp-item');
        if (!item) return;
        var id    = item.dataset.id;
        var stamp = cfg.stamps.find(function (s) { return s.id === id; });
        if (!stamp) return;
        App._curStamp = stamp;
        // 獲得済みは詳細表示、未取得はそのまま（タップでAR開始はしない）
        if (State.isAcquired(id)) {
          UI.showStampDetail(stamp, false);
        }
      };
    }
  },
};

/* ── ヘルパー ── */
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOOT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.addEventListener('DOMContentLoaded', function () { App.init(); });
