'use strict';
/* ============================================================
   WebAR Stamp Rally — app.js
   ============================================================ */

/* ---- 1. DB ------------------------------------------------- */
var DB=(function(){
  var NAME='StampRallyDB',VER=1,_db=null;
  function open(){
    if(_db)return Promise.resolve(_db);
    return new Promise(function(res,rej){
      var q=indexedDB.open(NAME,VER);
      q.onupgradeneeded=function(e){if(!e.target.result.objectStoreNames.contains('kv'))e.target.result.createObjectStore('kv');};
      q.onsuccess=function(e){_db=e.target.result;res(_db);};
      q.onerror=function(){rej(q.error);};
    });
  }
  function get(k){return open().then(function(db){return new Promise(function(res,rej){var q=db.transaction('kv','readonly').objectStore('kv').get(k);q.onsuccess=function(){res(q.result!==undefined?q.result:null);};q.onerror=function(){rej(q.error);};});}).catch(function(){var v=localStorage.getItem('sr_'+k);return v?JSON.parse(v):null;});}
  function set(k,v){return open().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=res;tx.onerror=function(){rej(tx.error);};});}).catch(function(){localStorage.setItem('sr_'+k,JSON.stringify(v));});}
  function del(k){return open().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('kv','readwrite');tx.objectStore('kv').delete(k);tx.oncomplete=res;tx.onerror=function(){rej(tx.error);};});}).catch(function(){localStorage.removeItem('sr_'+k);});}
  return{get:get,set:set,del:del};
}());

/* ---- 2. Default Config ------------------------------------- */
var DEFAULT_CONFIG={
  versionId:'2026_Ver1', adminPassword:'admin',
  sheetsUrl:'', leaderboardUrl:'',
  eventYear:'2026',
  eventTitle:'文化祭\nスタンプラリー',
  eventSubtitle:'全スタンプを集めて特典をゲットしよう！',
  startConfirmTitle:'スタートしますか？',
  startConfirmDesc:'タイマーが開始されます。\n準備ができたら「スタート！」を押してください。',
  startConfirmOk:'スタート！',
  startConfirmCancel:'キャンセル',
  ui:{
    btnStart:'スタート！',
    btnHowto:'遊び方',
    howtoTitle:'遊び方',
    mapTitle:'スタンプマップ',
    progressLabel:'進捗',
    btnScan:'ARスキャン開始',
    arTitle:'マーカーを照らして！',
    arHint:'マーカーを枠内に合わせてください',
    stampAcquiredLabel:'スタンプ獲得！',
    btnToMap:'マップに戻る',
    btnShare:'シェア',
    completeTitle:'コンプリート！',
    completeSubtitle:'全スタンプ制覇おめでとう！',
    completeTimeLabel:'クリアタイム',
    manualTitle:'合言葉入力',
    manualDesc:'スタンプ地点に掲示された数字を入力してください',
    manualSubmit:'確認',
    arCameraMsg:'カメラ起動中...',
    arCameraFallback:'⌨️ ボタンで合言葉入力もできます',
  },
  coupon:{
    title:'🎁 特典クーポン',
    body:'文化祭グッズ引換券！本部で見せてください',
    code:'FES-2026-COMP',
  },
  howtoSteps:[
    {title:'アプリを開く',desc:'このページをホーム画面に追加しておくと便利です。'},
    {title:'スタンプ場所へ行く',desc:'マップから場所を確認して出発しましょう！'},
    {title:'マーカーをスキャン',desc:'「ARスキャン開始」を押してカメラをマーカーに向けてください。'},
    {title:'スタンプをゲット',desc:'スキャン成功！スタンプが記録されます。'},
    {title:'コンプリートで特典',desc:'全スタンプを集めると特典クーポンが表示されます！'},
  ],
  stamps:[
    {id:'s01',name:'科学部の秘密実験',location:'3階 理科室',message:'サイエンスの世界へようこそ！',emoji:'🔬',code:'1234',barcodeId:0,modelUrl:'',mindFile:''},
    {id:'s02',name:'美術部ギャラリー',location:'2階 美術室',message:'芸術に触れてみよう！',emoji:'🎨',code:'2345',barcodeId:1,modelUrl:'',mindFile:''},
    {id:'s03',name:'音楽部ライブ',location:'体育館',message:'音楽の力を感じてください！',emoji:'🎵',code:'3456',barcodeId:2,modelUrl:'',mindFile:''},
    {id:'s04',name:'茶道部おもてなし',location:'和室',message:'お茶をどうぞ！',emoji:'🍵',code:'4567',barcodeId:3,modelUrl:'',mindFile:''},
    {id:'s05',name:'フードコート',location:'中庭',message:'美味しいものいっぱい！',emoji:'🍔',code:'5678',barcodeId:4,modelUrl:'',mindFile:''},
  ],
  mindFiles:[],
};

/* ---- 3. Config --------------------------------------------- */
var Config=(function(){
  var _cfg=null;
  function merge(t,s){var o=Object.assign({},t);Object.keys(s).forEach(function(k){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){o[k]=merge(t[k]||{},s[k]);}else{o[k]=s[k];}});return o;}
  function load(){
    return DB.get('config').then(function(c){
      _cfg=c?merge(DEFAULT_CONFIG,c):JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      return DB.get('versionId');
    }).then(function(sv){
      if(sv&&sv!==_cfg.versionId){return Promise.all([DB.del('progress'),DB.del('timerBase'),DB.del('timerRunSince')]);}
    }).then(function(){return DB.set('versionId',_cfg.versionId);})
    .then(function(){
      if(_cfg.sheetsUrl){return fetch(_cfg.sheetsUrl).then(function(r){return r.json();}).then(function(d){if(d&&typeof d==='object'){_cfg=merge(_cfg,d);return DB.set('config',_cfg);}}).catch(function(e){console.warn('Sheets:',e);});}
    }).then(function(){return _cfg;});
  }
  function save(){return DB.set('config',_cfg);}
  function get(){return _cfg;}
  function fetchSheets(url){return fetch(url).then(function(r){return r.json();}).then(function(d){if(d&&typeof d==='object'){_cfg=merge(_cfg,d);return DB.set('config',_cfg);}});}
  return{load:load,get:get,save:save,fetchSheets:fetchSheets};
}());

/* ---- 4. State ---------------------------------------------- */
/*
  タイマー設計:
  - timerBase   : 保存済み経過ms（DB永続化）
  - timerRunSince: タイマー動作開始時刻（Date.now()）、停止中はnull（DB永続化）
  - リロード時: timerBaseをDBから読み出し、timerRunSinceが残っていれば差分を加算して再開
  - これによりリロード後も正確な時間を維持
*/
var State=(function(){
  var _acq={};
  var _base=0;        // 保存済み経過ms
  var _runSince=null; // タイマー開始時刻(ms)、停止中はnull
  var _running=false;
  var _iv=null;

  function load(){
    return Promise.all([
      DB.get('progress'),
      DB.get('timerBase'),
      DB.get('timerRunSince'),
    ]).then(function(v){
      if(v[0]) v[0].forEach(function(id){_acq[id]=true;});
      _base=v[1]||0;
      if(v[2]){
        // リロード前にタイマーが動いていた → 差分をbaseに加算して再開
        var diff=Date.now()-v[2];
        _base+=diff;
        DB.set('timerBase',_base);
        DB.del('timerRunSince');
        // 再開
        _runSince=Date.now();
        _running=true;
        DB.set('timerRunSince',_runSince);
        _iv=setInterval(function(){UI.updateTimer(getElapsed());},500);
      }
    });
  }

  function startTimer(){
    if(_running) return;
    _running=true;
    _runSince=Date.now();
    DB.set('timerRunSince',_runSince);
    _iv=setInterval(function(){UI.updateTimer(getElapsed());},500);
  }

  function stopTimer(){
    if(!_running) return;
    _base+=Date.now()-_runSince;
    _running=false;
    _runSince=null;
    clearInterval(_iv); _iv=null;
    DB.set('timerBase',_base);
    DB.del('timerRunSince');
  }

  function getElapsed(){
    return _running ? _base+(Date.now()-_runSince) : _base;
  }

  function acquireStamp(id){
    if(_acq[id]) return Promise.resolve(false);
    _acq[id]=true;
    return DB.set('progress',Object.keys(_acq)).then(function(){return true;});
  }
  function isAcquired(id){return !!_acq[id];}
  function getCount(){return Object.keys(_acq).length;}
  function reset(){
    _acq={}; _base=0; _runSince=null; _running=false;
    clearInterval(_iv); _iv=null;
    return Promise.all([DB.del('progress'),DB.del('timerBase'),DB.del('timerRunSince')]);
  }
  return{load:load,startTimer:startTimer,stopTimer:stopTimer,getElapsed:getElapsed,acquireStamp:acquireStamp,isAcquired:isAcquired,getCount:getCount,reset:reset};
}());

/* ---- 5. UI ------------------------------------------------- */
var UI=(function(){
  var _tt=null;
  var _curScreen='screen-title';

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(function(s){s.style.display='none';});
    var el=document.getElementById(id);
    if(el) el.style.display='flex';
    _curScreen=id;
    // 管理者画面では設定ボタン非表示
    var btn=document.getElementById('btn-admin-entry');
    if(btn) btn.style.display=(id==='screen-admin')?'none':'flex';
  }
  function showModal(id){var el=document.getElementById(id);if(el)el.style.display='flex';}
  function hideModal(id){var el=document.getElementById(id);if(el)el.style.display='none';}
  function toast(msg,dur){
    var el=document.getElementById('toast');if(!el)return;
    el.textContent=msg;el.style.display='block';
    clearTimeout(_tt);_tt=setTimeout(function(){el.style.display='none';},dur||2500);
  }
  function pad(n){return n<10?'0'+n:String(n);}
  function fmtTime(ms){var t=Math.floor(ms/1000);return pad(Math.floor(t/60))+':'+pad(t%60);}
  function updateTimer(ms){var el=document.getElementById('timer-display');if(el)el.textContent=fmtTime(ms);}
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  function applyConfig(cfg){
    function st(id,v){var el=document.getElementById(id);if(el&&v!==undefined)el.textContent=v;}
    st('ui-event-year',cfg.eventYear);
    st('ui-event-title',cfg.eventTitle);
    st('ui-event-subtitle',cfg.eventSubtitle);
    st('ui-btn-start',cfg.ui.btnStart);
    st('ui-btn-howto',cfg.ui.btnHowto);
    st('ui-howto-title',cfg.ui.howtoTitle);
    st('ui-map-title',cfg.ui.mapTitle);
    st('ui-progress-label',cfg.ui.progressLabel);
    st('ui-btn-scan',cfg.ui.btnScan);
    st('ui-ar-title',cfg.ui.arTitle);
    st('ui-ar-hint',cfg.ui.arHint);
    st('ui-stamp-acquired-label',cfg.ui.stampAcquiredLabel);
    st('ui-btn-to-map',cfg.ui.btnToMap);
    st('ui-btn-share',cfg.ui.btnShare);
    st('ui-complete-title',cfg.ui.completeTitle);
    st('ui-complete-subtitle',cfg.ui.completeSubtitle);
    st('ui-complete-time-label',cfg.ui.completeTimeLabel);
    st('ui-manual-title',cfg.ui.manualTitle);
    st('ui-manual-desc',cfg.ui.manualDesc);
    st('ui-coupon-title',cfg.coupon.title);
    st('ui-coupon-body',cfg.coupon.body);
    st('ui-coupon-code',cfg.coupon.code);
    // スタート確認モーダル
    var pt=document.querySelector('.popup-title');if(pt)pt.textContent=cfg.startConfirmTitle||'スタートしますか？';
    var pd=document.querySelector('.popup-desc');if(pd)pd.textContent=cfg.startConfirmDesc||'準備ができたらスタートしてください。';
    var pok=document.getElementById('start-confirm-ok');if(pok){var sp=pok.querySelector('span:last-child');if(sp)sp.textContent=cfg.startConfirmOk||'スタート！';}
    var pca=document.getElementById('start-confirm-cancel');if(pca)pca.textContent=cfg.startConfirmCancel||'キャンセル';
    document.title=cfg.eventTitle.replace('\n','')+' '+cfg.eventYear;
  }

  function renderHowtoSteps(steps){
    var c=document.getElementById('howto-steps-container');if(!c)return;
    c.innerHTML=steps.map(function(s,i){
      return '<div class="howto-step"><div class="howto-step-num">'+(i+1)+'</div><div class="howto-step-body"><h3>'+esc(s.title)+'</h3><p>'+esc(s.desc)+'</p></div></div>';
    }).join('');
  }

  function renderStampList(stamps){
    var list=document.getElementById('stamp-list');if(!list)return;
    list.innerHTML=stamps.map(function(s){
      var acq=State.isAcquired(s.id);
      return '<div class="stamp-item'+(acq?' acquired':'')+'" data-id="'+s.id+'">'
        +'<div class="stamp-emoji">'+(s.emoji||'⭐')+'</div>'
        +'<div class="stamp-info"><div class="stamp-name">'+esc(s.name)+'</div><div class="stamp-loc-text">📍 '+esc(s.location)+'</div></div>'
        +'<div class="stamp-check">'+(acq?'✓':'')+'</div>'
      +'</div>';
    }).join('');
  }

  function updateProgress(stamps){
    var total=stamps.length,count=State.getCount(),pct=total?Math.round(count/total*100):0;
    var bar=document.getElementById('progress-bar');if(bar)bar.style.width=pct+'%';
    var lbl=document.getElementById('progress-count');if(lbl)lbl.textContent=count+' / '+total;
    renderStampList(stamps);
  }

  function showStampAcquired(stamp){
    document.getElementById('sa-emoji').textContent=stamp.emoji||'⭐';
    document.getElementById('sa-name').textContent=stamp.name;
    document.getElementById('sa-location').textContent=stamp.location;
    document.getElementById('sa-message').textContent=stamp.message;
    showScreen('screen-stamp');
    var c=document.getElementById('stamp-sparkles');if(!c)return;
    c.innerHTML='';
    var cols=['#c840ff','#00f0ff','#ffce00','#00e87a'];
    for(var i=0;i<22;i++){
      var d=document.createElement('div');d.className='sparkle';
      var sz=5+Math.random()*8,tx=(Math.random()-.5)*200,ty=-(40+Math.random()*120);
      d.style.cssText='left:'+Math.random()*100+'%;top:'+(50+Math.random()*40)+'%;width:'+sz+'px;height:'+sz+'px;background:'+cols[i%4]+';--tx:'+tx+'px;--ty:'+ty+'px;--d:'+(1+Math.random())+'s;--dl:'+(Math.random()*.4)+'s;';
      c.appendChild(d);
    }
  }

  function showComplete(cfg,elapsed){
    document.getElementById('complete-time-value').textContent=fmtTime(elapsed);
    showScreen('screen-complete');
    startConfetti();
  }

  function renderStars(){
    var c=document.getElementById('stars');if(!c)return;
    var f=document.createDocumentFragment();
    for(var i=0;i<60;i++){
      var el=document.createElement('div');el.className='star';
      var sz=1+Math.random()*2.5;
      el.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;width:'+sz+'px;height:'+sz+'px;--d:'+(2+Math.random()*4)+'s;--dl:'+(Math.random()*4)+'s;';
      f.appendChild(el);
    }
    c.appendChild(f);
  }

  return{showScreen:showScreen,showModal:showModal,hideModal:hideModal,toast:toast,fmtTime:fmtTime,updateTimer:updateTimer,esc:esc,applyConfig:applyConfig,renderHowtoSteps:renderHowtoSteps,renderStampList:renderStampList,updateProgress:updateProgress,showStampAcquired:showStampAcquired,showComplete:showComplete,renderStars:renderStars};
}());

/* ---- 6. Confetti ------------------------------------------ */
function startConfetti(){
  var canvas=document.getElementById('confetti-canvas');if(!canvas)return;
  canvas.width=canvas.offsetWidth||window.innerWidth;
  canvas.height=canvas.offsetHeight||window.innerHeight;
  var ctx=canvas.getContext('2d');
  var cols=['#c840ff','#00f0ff','#ffce00','#00e87a','#ff4458','#fff'];
  var pp=[];
  for(var i=0;i<120;i++)pp.push({x:Math.random()*canvas.width,y:-20-Math.random()*200,r:4+Math.random()*6,c:cols[i%6],sp:2+Math.random()*3,dr:(Math.random()-.5)*1.5,a:Math.random()*Math.PI*2,sp2:(Math.random()-.5)*.15});
  var fr;
  (function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);pp.forEach(function(p){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.7);ctx.restore();p.y+=p.sp;p.x+=p.dr;p.a+=p.sp2;if(p.y>canvas.height){p.y=-20;p.x=Math.random()*canvas.width;}});fr=requestAnimationFrame(draw);}());
  setTimeout(function(){cancelAnimationFrame(fr);ctx.clearRect(0,0,canvas.width,canvas.height);},8000);
}

/* ---- 7. Share --------------------------------------------- */
function doShare(title,text){
  if(navigator.share){navigator.share({title:title,text:text}).catch(function(){});}
  else if(navigator.clipboard){navigator.clipboard.writeText(text).then(function(){UI.toast('クリップボードにコピーしました！');});}
}

/* ---- 8. AR ------------------------------------------------- */
var AR=(function(){
  var _stamps=[],_onDetect=null,_cd={};
  function init(stamps,onDetect){_stamps=stamps;_onDetect=onDetect;}
  function startScene(){
    var wrapper=document.getElementById('ar-scene-wrapper');if(!wrapper)return;
    wrapper.innerHTML='';
    var cfg=Config.get();
    function build(){
      var html=_stamps.map(function(s){
        var obj=s.modelUrl
          ?'<a-gltf-model src="'+s.modelUrl+'" scale="0.12 0.12 0.12"></a-gltf-model>'
          :'<a-box color="#c840ff" scale="0.5 0.5 0.5"></a-box><a-text value="'+(s.emoji||'★')+'" align="center" position="0 0.7 0" scale="3 3 3"></a-text>';
        return s.mindFile
          ?'<a-nft id="mk-'+s.id+'" type="nft" url="'+s.mindFile+'" smooth="true" smoothCount="10">'+obj+'</a-nft>'
          :'<a-marker id="mk-'+s.id+'" type="barcode" value="'+s.barcodeId+'" smooth="true" smoothCount="10">'+obj+'</a-marker>';
      }).join('');
      wrapper.innerHTML='<a-scene embedded arjs="sourceType:webcam;debugUIEnabled:false;detectionMode:mono_and_matrix;matrixCodeType:3x3_hamming63;" vr-mode-ui="enabled:false" renderer="logarithmicDepthBuffer:true;antialias:true;" style="position:absolute;top:0;left:0;width:100%;height:100%;">'+html+'<a-entity camera></a-entity></a-scene>';
      var scene=wrapper.querySelector('a-scene');
      function attach(){_stamps.forEach(function(s){var mk=document.getElementById('mk-'+s.id);if(mk)mk.addEventListener('markerFound',function(){handleDetect(s);});});}
      if(scene&&scene.hasLoaded)attach();else if(scene)scene.addEventListener('loaded',attach);
      var st=document.getElementById('ar-status');
      if(st){
        st.textContent=(cfg&&cfg.ui&&cfg.ui.arCameraMsg)||'カメラ起動中...';
        var obs=new MutationObserver(function(){if(wrapper.querySelector('video')){st.textContent='';obs.disconnect();}});
        obs.observe(wrapper,{childList:true,subtree:true});
        setTimeout(function(){if(st.textContent!=='')st.textContent=(cfg&&cfg.ui&&cfg.ui.arCameraFallback)||'⌨️ ボタンで合言葉入力もできます';},7000);
      }
    }
    if(typeof AFRAME==='undefined'){
      var s1=document.createElement('script');
      s1.src='https://cdnjs.cloudflare.com/ajax/libs/aframe/1.4.2/aframe.min.js';
      s1.onload=function(){var s2=document.createElement('script');s2.src='https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js';s2.onload=build;document.head.appendChild(s2);};
      document.head.appendChild(s1);
    }else{build();}
  }
  function destroyScene(){var w=document.getElementById('ar-scene-wrapper');if(w)w.innerHTML='';_cd={};}
  function handleDetect(stamp){
    var now=Date.now();if(_cd[stamp.id]&&now-_cd[stamp.id]<4000)return;
    _cd[stamp.id]=now;
    var b=document.getElementById('ar-banner');
    if(b){document.getElementById('ar-banner-emoji').textContent=stamp.emoji||'🎉';document.getElementById('ar-banner-text').textContent=stamp.name+' をスキャン！';b.style.display='flex';setTimeout(function(){b.style.display='none';},3000);}
    if(_onDetect)_onDetect(stamp);
  }
  return{init:init,startScene:startScene,destroyScene:destroyScene};
}());

/* ---- 9. Touch Drag & Drop --------------------------------- */
function makeDraggable(listEl,onReorder){
  var src=null,ghost=null,touchItem=null;
  function items(){return Array.from(listEl.querySelectorAll('.stamp-admin-item'));}
  function idxOf(el){return items().indexOf(el);}
  function itemAtY(y){return items().find(function(i){var r=i.getBoundingClientRect();return y>=r.top&&y<=r.bottom;})||null;}
  function cleanup(){items().forEach(function(i){i.classList.remove('dragging','drag-over');});src=null;}

  function bind(){
    items().forEach(function(item){
      item.setAttribute('draggable','true');
      item.ondragstart=function(){src=item;item.classList.add('dragging');};
      item.ondragover=function(e){e.preventDefault();items().forEach(function(i){i.classList.remove('drag-over');});item.classList.add('drag-over');};
      item.ondrop=function(e){e.preventDefault();var si=idxOf(src),di=idxOf(item);if(src&&si!==di)onReorder(si,di);cleanup();};
      item.ondragend=cleanup;
      var handle=item.querySelector('.drag-icon');
      if(!handle)return;
      handle.ontouchstart=function(e){
        touchItem=item;item.classList.add('dragging');
        ghost=item.cloneNode(true);
        var r=item.getBoundingClientRect();
        ghost.style.cssText='position:fixed;z-index:9999;left:'+r.left+'px;top:'+r.top+'px;width:'+item.offsetWidth+'px;opacity:.85;pointer-events:none;background:var(--surf2);border:1.5px solid var(--accent);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
        document.body.appendChild(ghost);e.preventDefault();
      };
    });
    document.ontouchmove=function(e){
      if(!touchItem||!ghost)return;
      var t=e.touches[0];ghost.style.top=(t.clientY-30)+'px';
      items().forEach(function(i){i.classList.remove('drag-over');});
      var over=itemAtY(t.clientY);if(over&&over!==touchItem)over.classList.add('drag-over');
      e.preventDefault();
    };
    document.ontouchend=function(e){
      if(!touchItem||!ghost)return;
      var t=e.changedTouches[0],over=itemAtY(t.clientY);
      var si=idxOf(touchItem),di=over?idxOf(over):-1;
      if(over&&si!==di&&di>=0)onReorder(si,di);
      ghost.remove();ghost=null;
      items().forEach(function(i){i.classList.remove('dragging','drag-over');});
      touchItem=null;
    };
  }
  return{rebind:bind};
}

/* ---- 10. Admin -------------------------------------------- */
var Admin=(function(){
  var _cfg=null,_drag=null;
  function init(cfg){_cfg=cfg;renderAll();bindStatic();}

  function renderAll(){
    renderStampAdminList();renderMindList();renderTextEditors();renderHowtoEditor();
    var ve=document.getElementById('admin-current-version');if(ve)ve.textContent='v: '+_cfg.versionId;
    var vi=document.getElementById('admin-version-id');if(vi)vi.value=_cfg.versionId;
    var su=document.getElementById('admin-sheets-url');if(su)su.value=_cfg.sheetsUrl||'';
    var lu=document.getElementById('admin-leaderboard-url');if(lu)lu.value=_cfg.leaderboardUrl||'';
  }

  function renderStampAdminList(){
    var list=document.getElementById('stamp-admin-list');if(!list)return;
    list.innerHTML=_cfg.stamps.map(function(s,i){
      return '<div class="stamp-admin-item" data-idx="'+i+'">'
        +'<span class="drag-icon">☰</span>'
        +'<span class="stamp-admin-emoji">'+(s.emoji||'⭐')+'</span>'
        +'<div class="stamp-admin-info"><div class="stamp-admin-name">'+UI.esc(s.name)+'</div>'
        +'<div class="stamp-admin-sub">'+(s.mindFile?'.mind: '+s.mindFile:'バーコード #'+s.barcodeId)+' | 合言葉: '+s.code+'</div></div>'
        +'<button class="stamp-admin-edit-btn" data-id="'+s.id+'">編集</button>'
      +'</div>';
    }).join('');
    list.querySelectorAll('.stamp-admin-edit-btn').forEach(function(b){b.onclick=function(e){e.stopPropagation();openEdit(b.dataset.id);};});
    if(!_drag)_drag=makeDraggable(list,function(si,di){var a=_cfg.stamps.slice(),m=a.splice(si,1)[0];a.splice(di,0,m);_cfg.stamps=a;Config.save();renderStampAdminList();UI.updateProgress(_cfg.stamps);UI.toast('並び順を更新しました ✓');});
    _drag.rebind();
  }

  function renderMindList(){
    var list=document.getElementById('mind-file-list');if(!list)return;
    var files=_cfg.mindFiles||[];
    if(!files.length){list.innerHTML='<div style="font-size:13px;color:var(--muted);padding:8px 0;">登録ファイルなし</div>';return;}
    list.innerHTML=files.map(function(f,i){
      var linked=_cfg.stamps.find(function(s){return s.mindFile===f.name;});
      return '<div class="mind-file-item"><span style="font-size:20px">📄</span><div class="mind-file-name">'+UI.esc(f.name)+'</div><div class="mind-file-linked">'+(linked?'→ '+UI.esc(linked.name):'未リンク')+'</div><button style="color:var(--red);font-size:18px;padding:2px 6px;" data-idx="'+i+'">🗑</button></div>';
    }).join('');
    list.querySelectorAll('[data-idx]').forEach(function(b){b.onclick=function(){var idx=parseInt(b.dataset.idx),name=_cfg.mindFiles[idx].name;_cfg.mindFiles.splice(idx,1);_cfg.stamps.forEach(function(s){if(s.mindFile===name)s.mindFile='';});Config.save();renderMindList();renderStampAdminList();UI.toast('削除しました');};});
  }

  /* 文言編集: セクション別に充実 */
  function renderTextEditors(){
    renderGroup('text-editors-event',[
      {key:'eventYear',     label:'年度（バッジに表示）'},
      {key:'eventTitle',    label:'タイトル（改行は\\n）'},
      {key:'eventSubtitle', label:'サブタイトル'},
    ]);
    renderGroup('text-editors-start',[
      {key:'startConfirmTitle',  label:'確認ダイアログ タイトル'},
      {key:'startConfirmDesc',   label:'確認ダイアログ 説明文'},
      {key:'startConfirmOk',     label:'「スタート！」ボタン文言'},
      {key:'startConfirmCancel', label:'「キャンセル」ボタン文言'},
      {key:'ui.btnStart',        label:'タイトル画面「スタート！」ボタン'},
      {key:'ui.btnHowto',        label:'タイトル画面「遊び方」ボタン'},
    ]);
    renderGroup('text-editors-map',[
      {key:'ui.mapTitle',     label:'マップ画面 タイトル'},
      {key:'ui.progressLabel',label:'進捗ラベル'},
      {key:'ui.btnScan',      label:'「ARスキャン開始」ボタン'},
    ]);
    renderGroup('text-editors-ar',[
      {key:'ui.arTitle',          label:'ARスキャン画面 タイトル'},
      {key:'ui.arHint',           label:'スキャンヒント文'},
      {key:'ui.arCameraMsg',      label:'カメラ起動中メッセージ'},
      {key:'ui.arCameraFallback', label:'カメラ失敗時メッセージ'},
    ]);
    renderGroup('text-editors-stamp',[
      {key:'ui.stampAcquiredLabel', label:'スタンプ獲得 ラベル'},
      {key:'ui.btnToMap',           label:'「マップに戻る」ボタン'},
      {key:'ui.btnShare',           label:'「シェア」ボタン'},
      {key:'ui.manualTitle',        label:'合言葉モーダル タイトル'},
      {key:'ui.manualDesc',         label:'合言葉モーダル 説明文'},
      {key:'ui.manualSubmit',       label:'合言葉「確認」ボタン'},
    ]);
    renderGroup('text-editors-complete',[
      {key:'ui.completeTitle',    label:'コンプリート タイトル'},
      {key:'ui.completeSubtitle', label:'コンプリート サブタイトル'},
      {key:'ui.completeTimeLabel',label:'クリアタイム ラベル'},
    ]);
    renderGroup('text-editors-coupon',[
      {key:'coupon.title', label:'クーポン タイトル'},
      {key:'coupon.body',  label:'クーポン 本文'},
      {key:'coupon.code',  label:'クーポン コード'},
    ]);
  }

  function renderGroup(cid,rows){
    var c=document.getElementById(cid);if(!c)return;
    c.innerHTML=rows.map(function(r){
      var keys=r.key.split('.'),obj=_cfg;
      keys.forEach(function(k){obj=obj&&obj[k];});
      return '<div class="text-edit-row"><label>'+UI.esc(r.label)+'</label><input type="text" class="admin-input text-edit-input" data-key="'+r.key+'" value="'+UI.esc(String(obj||''))+'"></div>';
    }).join('');
  }

  function collectTexts(){
    document.querySelectorAll('.text-edit-input').forEach(function(el){
      var keys=el.dataset.key.split('.'),obj=_cfg;
      for(var i=0;i<keys.length-1;i++)obj=obj[keys[i]];
      obj[keys[keys.length-1]]=el.value;
    });
  }

  function renderHowtoEditor(){
    var c=document.getElementById('howto-editor');if(!c)return;
    c.innerHTML=(_cfg.howtoSteps||[]).map(function(s,i){
      return '<div class="howto-edit-item" data-idx="'+i+'">'
        +'<div class="howto-edit-num">'+(i+1)+'</div>'
        +'<div class="howto-edit-fields">'
          +'<input type="text" class="admin-input" placeholder="タイトル" value="'+UI.esc(s.title)+'" data-field="title" data-idx="'+i+'">'
          +'<input type="text" class="admin-input" placeholder="説明" value="'+UI.esc(s.desc)+'" data-field="desc" data-idx="'+i+'">'
        +'</div><button class="howto-del" data-idx="'+i+'">✕</button></div>';
    }).join('');
    c.querySelectorAll('input').forEach(function(el){el.oninput=function(){var idx=parseInt(el.dataset.idx);if(_cfg.howtoSteps[idx])_cfg.howtoSteps[idx][el.dataset.field]=el.value;};});
    c.querySelectorAll('.howto-del').forEach(function(b){b.onclick=function(){_cfg.howtoSteps.splice(parseInt(b.dataset.idx),1);renderHowtoEditor();};});
  }

  function openEdit(id){
    var s=id?(_cfg.stamps.find(function(x){return x.id===id;})||{}):{}; var isNew=!s.id;
    document.getElementById('stamp-edit-title').textContent=isNew?'スタンプ追加':'スタンプ編集';
    document.getElementById('stamp-edit-id').value=s.id||'';
    document.getElementById('stamp-edit-name').value=s.name||'';
    document.getElementById('stamp-edit-location').value=s.location||'';
    document.getElementById('stamp-edit-message').value=s.message||'';
    document.getElementById('stamp-edit-emoji').value=s.emoji||'⭐';
    document.getElementById('stamp-edit-code').value=s.code||'';
    document.getElementById('stamp-edit-model').value=s.modelUrl||'';
    document.getElementById('stamp-edit-barcode').value=s.barcodeId!==undefined?s.barcodeId:'';
    var sel=document.getElementById('stamp-edit-mind');
    sel.innerHTML='<option value="">バーコードを使用（.mindなし）</option>'+(_cfg.mindFiles||[]).map(function(f){return '<option value="'+UI.esc(f.name)+'"'+(s.mindFile===f.name?' selected':'')+'>'+UI.esc(f.name)+'</option>';}).join('');
    document.getElementById('stamp-edit-delete').style.display=isNew?'none':'';
    UI.showModal('modal-stamp-edit');
  }

  function saveEdit(){
    var id=document.getElementById('stamp-edit-id').value;
    var name=document.getElementById('stamp-edit-name').value.trim();
    var loc=document.getElementById('stamp-edit-location').value.trim();
    if(!name){UI.toast('スタンプ名を入力してください');return;}
    if(!loc){UI.toast('場所を入力してください');return;}
    var data={id:id||('s'+Date.now()),name:name,location:loc,message:document.getElementById('stamp-edit-message').value,emoji:document.getElementById('stamp-edit-emoji').value||'⭐',code:document.getElementById('stamp-edit-code').value,modelUrl:document.getElementById('stamp-edit-model').value,barcodeId:parseInt(document.getElementById('stamp-edit-barcode').value)||0,mindFile:document.getElementById('stamp-edit-mind').value};
    var idx=id?_cfg.stamps.findIndex(function(s){return s.id===id;}):-1;
    if(idx>=0)_cfg.stamps[idx]=data;else _cfg.stamps.push(data);
    Config.save();renderAll();UI.hideModal('modal-stamp-edit');UI.toast('スタンプを保存しました ✓');
    AR.init(_cfg.stamps,App.onStampDetect);UI.updateProgress(_cfg.stamps);
  }

  function deleteStamp(id){
    if(!confirm('このスタンプを削除しますか？'))return;
    _cfg.stamps=_cfg.stamps.filter(function(s){return s.id!==id;});
    Config.save();renderAll();UI.hideModal('modal-stamp-edit');UI.toast('削除しました');
    AR.init(_cfg.stamps,App.onStampDetect);UI.updateProgress(_cfg.stamps);
  }

  function readMind(file){var r=new FileReader();r.onload=function(e){if(!_cfg.mindFiles)_cfg.mindFiles=[];_cfg.mindFiles.push({name:file.name,data:e.target.result});Config.save();renderMindList();UI.toast('.mindファイルを追加しました ✓');};r.readAsDataURL(file);}

  function bindStatic(){
    // タブ切り替え
    document.querySelectorAll('.admin-tab').forEach(function(tab){
      tab.onclick=function(){
        document.querySelectorAll('.admin-tab').forEach(function(t){t.classList.remove('active');});
        document.querySelectorAll('.admin-tab-pane').forEach(function(p){p.style.display='none';p.classList.remove('active');});
        tab.classList.add('active');
        var pane=document.getElementById('tab-'+tab.dataset.tab);
        if(pane){pane.style.display='block';pane.classList.add('active');}
      };
    });

    B('btn-add-stamp',function(){openEdit(null);});
    B('stamp-edit-close',function(){UI.hideModal('modal-stamp-edit');});
    B('stamp-edit-backdrop',function(){UI.hideModal('modal-stamp-edit');});
    B('stamp-edit-save',saveEdit);
    B('stamp-edit-delete',function(){deleteStamp(document.getElementById('stamp-edit-id').value);});

    var mi=document.getElementById('mind-file-input');
    var dz=document.getElementById('mind-upload-area');
    if(dz){dz.onclick=function(){if(mi)mi.click();};dz.ondragover=function(e){e.preventDefault();dz.classList.add('drag-active');};dz.ondragleave=function(){dz.classList.remove('drag-active');};dz.ondrop=function(e){e.preventDefault();dz.classList.remove('drag-active');var f=e.dataTransfer.files[0];if(f&&f.name.endsWith('.mind'))readMind(f);else UI.toast('.mindファイルのみ対応しています');};}
    if(mi)mi.onchange=function(e){var f=e.target.files[0];if(f)readMind(f);e.target.value='';};

    B('btn-add-howto-step',function(){_cfg.howtoSteps.push({title:'新しいステップ',desc:'説明を入力してください'});renderHowtoEditor();});
    B('btn-save-texts',function(){collectTexts();Config.save();UI.applyConfig(_cfg);UI.renderHowtoSteps(_cfg.howtoSteps);UI.toast('文言を保存しました ✓');});

    B('btn-update-version',function(){
      var nv=document.getElementById('admin-version-id').value.trim();
      if(!nv){UI.toast('バージョンIDを入力してください');return;}
      if(!confirm('バージョンを「'+nv+'」に更新すると参加者の進捗がリセットされます。よろしいですか？'))return;
      _cfg.versionId=nv;Config.save().then(function(){return DB.set('versionId',nv);}).then(function(){return State.reset();}).then(function(){UI.updateProgress(_cfg.stamps);UI.updateTimer(0);var ve=document.getElementById('admin-current-version');if(ve)ve.textContent='v: '+nv;UI.toast('バージョンを更新しました ✓');});
    });

    B('btn-fetch-sheets',function(){
      var url=document.getElementById('admin-sheets-url').value.trim();
      var st=document.getElementById('sheets-status');
      if(!url){UI.toast('URLを入力してください');return;}
      _cfg.sheetsUrl=url;if(st)st.textContent='取得中...';
      Config.fetchSheets(url).then(function(){Config.save();renderAll();UI.applyConfig(_cfg);UI.updateProgress(_cfg.stamps);if(st)st.textContent='✓ 取得成功';UI.toast('読み込みました ✓');}).catch(function(e){if(st)st.textContent='✗ 失敗: '+e.message;UI.toast('取得に失敗しました');});
    });

    B('btn-view-leaderboard',function(){_cfg.leaderboardUrl=document.getElementById('admin-leaderboard-url').value.trim();Config.save();showLeaderboard();});
    B('lb-close',function(){UI.hideModal('modal-leaderboard');});
    B('lb-backdrop',function(){UI.hideModal('modal-leaderboard');});

    B('btn-export-json',function(){var b=new Blob([JSON.stringify(_cfg,null,2)],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='stamp-rally-'+_cfg.versionId+'.json';a.click();});
    var imp=document.getElementById('import-json-input');
    if(imp)imp.onchange=function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){try{Object.assign(_cfg,JSON.parse(ev.target.result));Config.save();renderAll();UI.applyConfig(_cfg);UI.updateProgress(_cfg.stamps);AR.init(_cfg.stamps,App.onStampDetect);UI.toast('インポートしました ✓');}catch(err){UI.toast('JSONの形式が正しくありません');}};r.readAsText(f);e.target.value='';};

    B('btn-reset-all',function(){if(!confirm('この端末のすべてのデータをリセットしますか？'))return;State.reset().then(function(){UI.updateProgress(_cfg.stamps);UI.updateTimer(0);UI.toast('リセットしました');});});
  }

  function showLeaderboard(){
    if(!_cfg.leaderboardUrl){UI.toast('ランキングURLが設定されていません');return;}
    var list=document.getElementById('lb-list');if(list)list.innerHTML='<div style="text-align:center;color:var(--muted);padding:24px;">読み込み中...</div>';
    UI.showModal('modal-leaderboard');
    fetch(_cfg.leaderboardUrl+'?version='+encodeURIComponent(_cfg.versionId)).then(function(r){return r.json();}).then(function(d){
      var medals=['r1','r2','r3'];
      list.innerHTML=(d.entries&&d.entries.length)?d.entries.map(function(e,i){return '<div class="lb-item"><div class="lb-rank '+(medals[i]||'')+'">'+String(i+1)+'</div><div class="lb-name">'+UI.esc(e.name)+'</div><div class="lb-time">'+UI.fmtTime(e.time)+'</div></div>';}).join(''):'<div style="text-align:center;color:var(--muted);padding:24px;">記録なし</div>';
    }).catch(function(){list.innerHTML='<div style="text-align:center;color:var(--muted);padding:24px;">読み込みに失敗しました</div>';});
  }

  return{init:init};
}());

/* ---- 11. App ---------------------------------------------- */
var App={
  _cfg:null,_curStamp:null,
  onStampDetect:function(stamp){
    State.acquireStamp(stamp.id).then(function(isNew){
      if(!isNew)return;
      App._curStamp=stamp;
      UI.showStampAcquired(stamp);
      UI.updateProgress(App._cfg.stamps);
      if(State.getCount()>=App._cfg.stamps.length){State.stopTimer();setTimeout(function(){UI.showComplete(App._cfg,State.getElapsed());},1200);}
    });
  },
  init:function(){
    Config.load().then(function(cfg){
      App._cfg=cfg;
      return State.load().then(function(){return cfg;});
    }).then(function(cfg){
      UI.applyConfig(cfg);
      UI.renderStars();
      UI.renderHowtoSteps(cfg.howtoSteps);
      UI.updateProgress(cfg.stamps);
      UI.updateTimer(State.getElapsed());
      AR.init(cfg.stamps,App.onStampDetect);
      Admin.init(cfg);
      App.bindNav();
      App.bindModals();
      UI.showScreen('screen-title');
    }).catch(function(e){console.error(e);UI.showScreen('screen-title');});
  },
  bindNav:function(){
    var cfg=App._cfg;
    B('btn-start',function(){UI.showModal('modal-start-confirm');});
    B('start-confirm-ok',function(){UI.hideModal('modal-start-confirm');UI.showScreen('screen-map');State.startTimer();});
    B('start-confirm-cancel',function(){UI.hideModal('modal-start-confirm');});
    B('start-confirm-backdrop',function(){UI.hideModal('modal-start-confirm');});
    B('btn-howto',function(){UI.showModal('modal-howto');});
    B('btn-back-to-title',function(){AR.destroyScene();UI.showScreen('screen-title');});
    B('btn-go-scan',function(){UI.showScreen('screen-ar');AR.startScene();});
    B('btn-ar-back',function(){AR.destroyScene();UI.showScreen('screen-map');});
    B('btn-ar-manual',function(){document.getElementById('manual-input').value='';document.getElementById('manual-error').style.display='none';UI.showModal('modal-manual');});
    B('btn-to-map',function(){UI.showScreen('screen-map');});
    B('btn-share',function(){if(App._curStamp){var c=cfg;doShare(c.eventTitle.replace('\n',''),'📍 '+App._curStamp.name+' のスタンプをゲット！\n'+App._curStamp.message+'\n\n'+c.eventTitle.replace('\n','')+' '+c.eventYear);}});
    B('btn-complete-share',function(){doShare(cfg.eventTitle.replace('\n',''),'🏆 全スタンプをコンプリート！\nクリアタイム: '+UI.fmtTime(State.getElapsed())+'\n\n'+cfg.eventTitle.replace('\n','')+' '+cfg.eventYear);});
    B('btn-complete-restart',function(){UI.showScreen('screen-map');});
    B('btn-admin-entry',function(){var pw=prompt('管理者パスワードを入力してください（初期: admin）');if(pw===(cfg.adminPassword||'admin'))UI.showScreen('screen-admin');else if(pw!==null)UI.toast('パスワードが違います');});
    B('btn-admin-back',function(){UI.showScreen('screen-title');});
  },
  bindModals:function(){
    var cfg=App._cfg;
    B('howto-backdrop',function(){UI.hideModal('modal-howto');});
    B('howto-close',function(){UI.hideModal('modal-howto');});
    B('howto-ok',function(){UI.hideModal('modal-howto');});
    B('manual-backdrop',function(){UI.hideModal('modal-manual');});
    B('manual-close',function(){UI.hideModal('modal-manual');});
    B('manual-submit',function(){
      var val=(document.getElementById('manual-input').value||'').trim();
      var match=cfg.stamps.find(function(s){return s.code===val;});
      var err=document.getElementById('manual-error');
      if(match){UI.hideModal('modal-manual');App.onStampDetect(match);}
      else{err.style.display='block';}
    });
    var mi=document.getElementById('manual-input');
    if(mi)mi.onkeydown=function(e){if(e.key==='Enter')document.getElementById('manual-submit').click();};
    var sl=document.getElementById('stamp-list');
    if(sl)sl.onclick=function(e){var item=e.target.closest('.stamp-item');if(!item)return;var id=item.dataset.id;if(State.isAcquired(id)){var stamp=cfg.stamps.find(function(s){return s.id===id;});if(stamp){App._curStamp=stamp;UI.showStampAcquired(stamp);}}};
  },
};

function B(id,fn){var el=document.getElementById(id);if(el)el.addEventListener('click',fn);}

if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});

document.addEventListener('DOMContentLoaded',function(){App.init();});
