(() => {
  'use strict';

  const VERSION = 'CONSULT-TUTORIAL-STANDARD-V1.1-20260830';
  const STORAGE_KEY = 'dpro_tutorial_consult_v1_1_state';
  const POS_KEY = 'dpro_tutorial_consult_v1_1_card_pos';
  const ROOT_ID = 'dpro-tutorial-v11-root';
  const HIGHLIGHT_ID = 'dpro-tutorial-v11-highlight';
  const LAUNCHER_ID = 'dpro-tutorial-v11-launcher';
  const MARGIN = 8;

  const STEPS = Object.freeze([
    {id:'CONSULT-T01',order:1,route:'index.html',query:{purpose:'consultation'},primary:'.hero',fallback:['.hero-inner','.content'],title:'受付画面の全体像',copy:'相談・手続き依頼・面談予約を一つの入口から始める画面です。まず受付の流れ全体を確認します。'},
    {id:'CONSULT-T02',order:2,route:'index.html',query:{purpose:'consultation'},primary:'#privacy-notice',fallback:['.notice','.content'],title:'機密情報を入力しない',copy:'マイナンバー、本人確認書類、診断書、口座情報などは入力・添付しない運用を確認します。'},
    {id:'CONSULT-T03',order:3,route:'index.html',query:{purpose:'consultation'},primary:'[data-purpose="consultation"]',fallback:['.purpose-grid','.purpose-card'],title:'労務相談の入口',copy:'労務相談・手続き依頼・面談予約から目的を選べます。Tutorialは選択肢を説明するだけで自動クリックしません。'},
    {id:'CONSULT-T04',order:4,route:'index.html',query:{purpose:'consultation'},primary:'#main-panel',fallback:['#loading-panel','#request-form','.panel'],title:'必要事項を確認する',copy:'顧問先番号・担当者情報・相談内容を入力する領域です。Tutorialでは入力や送信を行いません。'},
    {id:'CONSULT-T05',order:5,route:'member.html',query:{},primary:'.hero',fallback:['#hero-account','.content'],title:'対応状況をまとめて確認',copy:'相談・手続き・面談・必要書類を確認する顧問先マイページです。'},
    {id:'CONSULT-T06',order:6,route:'member.html',query:{},primary:'#login-panel',fallback:['#login-form','.login-panel'],title:'顧問先確認',copy:'顧問先番号と登録電話番号で本人確認する領域です。営業デモボタンやログイン送信はTutorialから自動実行しません。'},
    {id:'CONSULT-T07',order:7,route:'staff.html',query:{},primary:'#login-overlay .login-card',fallback:['#login-overlay','.login-card'],title:'担当者ワークの入口',copy:'担当者PINで担当業務を開く画面です。TutorialはPIN入力・ログインを自動化しません。'},
    {id:'CONSULT-T08',order:8,route:'owner.html',query:{},primary:'#login-overlay .login-card',fallback:['#login-overlay','.login-card'],title:'事務所管理画面の入口',copy:'管理コードでオーナーPCを開く入口です。営業前デモ準備・設定保存・案件更新はTutorial対象外です。'},
    {id:'CONSULT-T09',order:9,route:'owner-ipad.html',query:{},primary:'#login-overlay .login-card',fallback:['#login-overlay','.login-card'],title:'受付iPadの入口',copy:'来所受付・面談対応・顧問先検索を行うiPad画面の入口です。Tutorialは受付登録やステータス更新を実行しません。'},
    {id:'CONSULT-T10',order:10,route:'demo-guide.html',query:{},primary:'#screenGrid',fallback:['main.page','.grid','.section-head'],title:'画面一覧と推奨確認順',copy:'公開デモの4画面と推奨確認順を確認してFirst10を完了します。'}
  ]);

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function readState() {
    const base = {version:VERSION,status:'idle',step:0,updatedAt:'',lastUrl:''};
    try {
      const parsed = safeJsonParse(localStorage.getItem(STORAGE_KEY) || '', null);
      if (!parsed || parsed.version !== VERSION) return base;
      const step = Number(parsed.step);
      return {...base,...parsed,step:Number.isInteger(step) && step >= 0 && step < STEPS.length ? step : 0};
    } catch { return base; }
  }

  function writeState(patch) {
    const next = {...readState(),...patch,version:VERSION,updatedAt:new Date().toISOString(),lastUrl:location.href};
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    window.dispatchEvent(new CustomEvent('dpro:tutorial-state',{detail:next}));
    return next;
  }

  function readPos() {
    try { return safeJsonParse(localStorage.getItem(POS_KEY) || '', null); } catch { return null; }
  }
  function writePos(x,y) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({x,y})); } catch {}
  }

  function currentFile() {
    const value = location.pathname.split('/').pop();
    return value || 'index.html';
  }

  function stepUrl(index) {
    const step = STEPS[index];
    const url = new URL(`./${step.route}`, location.href);
    Object.entries(step.query || {}).forEach(([k,v]) => url.searchParams.set(k,v));
    url.hash = `tutorial=${step.order}`;
    return url;
  }

  function onStepRoute(index) {
    const step = STEPS[index];
    if (currentFile() !== step.route) return false;
    for (const [k,v] of Object.entries(step.query || {})) {
      if (new URL(location.href).searchParams.get(k) !== String(v)) return false;
    }
    return true;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function resolveTarget(step) {
    const selectors = [step.primary,...step.fallback];
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (isVisible(el)) return {el,selector,fallback:selector !== step.primary};
      } catch {}
    }
    const main = document.querySelector('main') || document.body;
    return {el:main,selector:'main/body safety fallback',fallback:true};
  }

  function ensureUi() {
    if (document.getElementById(ROOT_ID)) return;
    const highlight = document.createElement('div');
    highlight.id = HIGHLIGHT_ID;
    highlight.setAttribute('aria-hidden','true');

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.hidden = true;
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','false');
    root.setAttribute('aria-labelledby','dpro-tutorial-v11-title');
    root.innerHTML = `
      <div class="dpro-tutorial-handle" data-tutorial-drag-handle tabindex="0" aria-label="チュートリアルカードを移動">
        <span>操作ガイド</span><span aria-hidden="true">⋮⋮</span>
      </div>
      <div class="dpro-tutorial-body">
        <div class="dpro-tutorial-progress"><span id="dpro-tutorial-v11-step"></span><span id="dpro-tutorial-v11-id"></span></div>
        <h2 id="dpro-tutorial-v11-title"></h2>
        <p id="dpro-tutorial-v11-copy"></p>
        <p class="dpro-tutorial-fallback" id="dpro-tutorial-v11-fallback" hidden></p>
      </div>
      <div class="dpro-tutorial-actions">
        <button type="button" data-tutorial-action="back">戻る</button>
        <button type="button" data-tutorial-action="skip">スキップ</button>
        <button type="button" data-tutorial-action="close">閉じる</button>
        <button type="button" class="primary" data-tutorial-action="next">次へ</button>
      </div>`;

    const launcher = document.createElement('button');
    launcher.id = LAUNCHER_ID;
    launcher.type = 'button';
    launcher.textContent = '操作ガイド';
    launcher.setAttribute('aria-label','操作ガイドを開始または再開');

    document.documentElement.append(highlight, root, launcher);
    bindUi(root, launcher);
  }

  function clampPoint(x,y,root) {
    const rect = root.getBoundingClientRect();
    const maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN);
    return {
      x: Math.min(Math.max(MARGIN, Number.isFinite(x) ? x : MARGIN), maxX),
      y: Math.min(Math.max(MARGIN, Number.isFinite(y) ? y : MARGIN), maxY)
    };
  }

  function setCardPos(x,y,save=true) {
    const root = document.getElementById(ROOT_ID);
    if (!root || root.hidden) return;
    const p = clampPoint(x,y,root);
    root.style.left = `${p.x}px`;
    root.style.top = `${p.y}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    if (save) writePos(p.x,p.y);
  }

  function initialCardPos(targetRect) {
    const root = document.getElementById(ROOT_ID);
    const saved = readPos();
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      setCardPos(saved.x,saved.y,false);
      return;
    }
    const rect = root.getBoundingClientRect();
    let x = Math.max(MARGIN, window.innerWidth - rect.width - 16);
    let y = 16;
    if (targetRect) {
      const below = targetRect.bottom + 12;
      const above = targetRect.top - rect.height - 12;
      y = below + rect.height <= window.innerHeight ? below : (above >= MARGIN ? above : Math.max(MARGIN,window.innerHeight-rect.height-16));
      if (targetRect.right > window.innerWidth * .58) x = 16;
    }
    setCardPos(x,y,false);
  }

  function updateHighlight(target) {
    const hi = document.getElementById(HIGHLIGHT_ID);
    if (!hi || !target || !isVisible(target)) { if (hi) hi.hidden = true; return; }
    const r = target.getBoundingClientRect();
    const pad = 5;
    const left = Math.max(2,r.left-pad);
    const top = Math.max(2,r.top-pad);
    const right = Math.min(window.innerWidth-2,r.right+pad);
    const bottom = Math.min(window.innerHeight-2,r.bottom+pad);
    hi.hidden = false;
    hi.style.left = `${left}px`;
    hi.style.top = `${top}px`;
    hi.style.width = `${Math.max(0,right-left)}px`;
    hi.style.height = `${Math.max(0,bottom-top)}px`;
  }

  function scrollTarget(target,done) {
    if (!target || target === document.body) { done(); return; }
    const r = target.getBoundingClientRect();
    const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    if (inView) { done(); return; }
    try { target.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'}); } catch {}
    requestAnimationFrame(done);
  }

  function hideTutorial(keepState=true) {
    const root = document.getElementById(ROOT_ID);
    const hi = document.getElementById(HIGHLIGHT_ID);
    if (root) root.hidden = true;
    if (hi) hi.hidden = true;
    if (!keepState) writeState({status:'idle',step:0});
    updateLauncher();
  }

  function showCompletion(status='completed') {
    const root = document.getElementById(ROOT_ID);
    const hi = document.getElementById(HIGHLIGHT_ID);
    if (hi) hi.hidden = true;
    if (!root) return;
    root.hidden = false;
    root.innerHTML = `
      <div class="dpro-tutorial-handle" data-tutorial-drag-handle tabindex="0" aria-label="チュートリアルカードを移動"><span>操作ガイド</span><span aria-hidden="true">⋮⋮</span></div>
      <div class="dpro-tutorial-body"><div class="dpro-tutorial-progress"><span>10 / 10</span><span>${status === 'completed' ? '完了' : 'スキップ済み'}</span></div><h2 id="dpro-tutorial-v11-title">${status === 'completed' ? 'First10 完了' : 'ガイドを終了しました'}</h2><p>${status === 'completed' ? '10ステップの確認が完了しました。必要なときは最初から再生できます。' : 'いつでも最初から再生できます。'}</p></div>
      <div class="dpro-tutorial-actions"><button type="button" data-tutorial-action="close">閉じる</button><button type="button" class="primary" data-tutorial-action="replay">Replay</button></div>`;
    bindRootActions(root);
    initialCardPos(null);
    const replay = root.querySelector('[data-tutorial-action="replay"]');
    if (replay) replay.focus({preventScroll:true});
    updateLauncher();
  }

  function navigateTo(index, {force=false} = {}) {
    const nextIndex = Math.min(Math.max(0,index), STEPS.length-1);
    writeState({status:'active',step:nextIndex});
    if (!force && onStepRoute(nextIndex)) { showStep(nextIndex); return; }
    location.assign(stepUrl(nextIndex).href);
  }

  function showStep(index) {
    ensureUi();
    if (!onStepRoute(index)) { navigateTo(index,{force:true}); return; }
    const step = STEPS[index];
    const root = document.getElementById(ROOT_ID);
    const hi = document.getElementById(HIGHLIGHT_ID);
    const resolved = resolveTarget(step);
    writeState({status:'active',step:index});

    const title = root.querySelector('#dpro-tutorial-v11-title');
    const copy = root.querySelector('#dpro-tutorial-v11-copy');
    const progress = root.querySelector('#dpro-tutorial-v11-step');
    const id = root.querySelector('#dpro-tutorial-v11-id');
    const fb = root.querySelector('#dpro-tutorial-v11-fallback');
    if (!title || !copy || !progress || !id || !fb) {
      root.innerHTML = '';
      root.remove();
      if (hi) hi.remove();
      ensureUi();
      return showStep(index);
    }
    progress.textContent = `${index+1} / ${STEPS.length}`;
    id.textContent = step.id;
    title.textContent = step.title;
    copy.textContent = step.copy;
    fb.hidden = !resolved.fallback;
    fb.textContent = resolved.fallback ? `安全な代替表示を使用中：${resolved.selector}` : '';
    const back = root.querySelector('[data-tutorial-action="back"]');
    const next = root.querySelector('[data-tutorial-action="next"]');
    if (back) back.disabled = index === 0;
    if (next) next.textContent = index === STEPS.length-1 ? '完了' : '次へ';
    root.hidden = false;

    scrollTarget(resolved.el, () => {
      updateHighlight(resolved.el);
      initialCardPos(resolved.el.getBoundingClientRect());
      requestAnimationFrame(() => {
        updateHighlight(resolved.el);
        const nextBtn = root.querySelector('[data-tutorial-action="next"]');
        if (nextBtn) nextBtn.focus({preventScroll:true});
      });
    });
    updateLauncher();
  }

  function next() {
    const state = readState();
    const idx = state.step;
    if (idx >= STEPS.length-1) {
      writeState({status:'completed',step:0,completedAt:new Date().toISOString()});
      showCompletion('completed');
      return;
    }
    navigateTo(idx+1);
  }
  function back() {
    const state = readState();
    if (state.step <= 0) return;
    navigateTo(state.step-1);
  }
  function close() { hideTutorial(true); }
  function skip() {
    writeState({status:'skipped',step:0,skippedAt:new Date().toISOString()});
    showCompletion('skipped');
  }
  function replay() {
    writeState({status:'active',step:0,replayedAt:new Date().toISOString()});
    navigateTo(0,{force:!onStepRoute(0)});
  }
  function start() {
    writeState({status:'active',step:0,startedAt:new Date().toISOString()});
    navigateTo(0,{force:!onStepRoute(0)});
  }
  function resume() {
    const state = readState();
    const idx = state.status === 'active' ? state.step : 0;
    navigateTo(idx,{force:!onStepRoute(idx)});
  }

  function bindRootActions(root) {
    root.querySelectorAll('[data-tutorial-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-tutorial-action');
        if (action === 'next') next();
        else if (action === 'back') back();
        else if (action === 'close') close();
        else if (action === 'skip') skip();
        else if (action === 'replay') replay();
      });
    });
    bindDrag(root);
  }

  function bindUi(root, launcher) {
    bindRootActions(root);
    launcher.addEventListener('click', () => {
      const state = readState();
      if (state.status === 'active') resume();
      else if (state.status === 'completed' || state.status === 'skipped') replay();
      else start();
    });
  }

  function bindDrag(root) {
    const handle = root.querySelector('[data-tutorial-drag-handle]');
    if (!handle || handle.dataset.boundDrag === '1') return;
    handle.dataset.boundDrag = '1';
    let drag = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType !== 'touch') return;
      const r = root.getBoundingClientRect();
      drag = {id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
      handle.setPointerCapture?.(e.pointerId);
      handle.classList.add('dragging');
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      setCardPos(e.clientX-drag.dx,e.clientY-drag.dy,true);
      e.preventDefault();
    });
    const stop = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      try { handle.releasePointerCapture?.(e.pointerId); } catch {}
      handle.classList.remove('dragging');
      drag = null;
      e.preventDefault();
    };
    handle.addEventListener('pointerup',stop);
    handle.addEventListener('pointercancel',stop);
    handle.addEventListener('keydown',(e)=>{
      const rootRect=root.getBoundingClientRect();
      let x=rootRect.left,y=rootRect.top;
      const delta=e.shiftKey?40:12;
      if(e.key==='ArrowLeft')x-=delta; else if(e.key==='ArrowRight')x+=delta; else if(e.key==='ArrowUp')y-=delta; else if(e.key==='ArrowDown')y+=delta; else return;
      setCardPos(x,y,true); e.preventDefault();
    });
  }

  function updateLauncher() {
    const launcher = document.getElementById(LAUNCHER_ID);
    if (!launcher) return;
    const state = readState();
    launcher.textContent = state.status === 'active' ? `Resume ${state.step+1}/10` : (state.status === 'completed' || state.status === 'skipped' ? 'Replay Tutorial' : '操作ガイド');
  }

  function parseHashStep() {
    const m = location.hash.match(/(?:^#|[&#])tutorial=(\d{1,2})(?:&|$)/);
    if (!m) return null;
    const n = Number(m[1]);
    return n >= 1 && n <= STEPS.length ? n-1 : null;
  }

  function onResizeOrScroll() {
    const root = document.getElementById(ROOT_ID);
    if (root && !root.hidden) {
      const r = root.getBoundingClientRect();
      setCardPos(r.left,r.top,false);
      const state = readState();
      if (state.status === 'active' && onStepRoute(state.step)) {
        updateHighlight(resolveTarget(STEPS[state.step]).el);
      }
    }
  }

  function boot() {
    if (document.documentElement.dataset.dproTutorialV11 === VERSION) return;
    document.documentElement.dataset.dproTutorialV11 = VERSION;
    ensureUi();
    updateLauncher();
    const hashStep = parseHashStep();
    if (hashStep !== null) {
      writeState({status:'active',step:hashStep});
      showStep(hashStep);
    } else {
      const state = readState();
      if (state.status === 'active' && onStepRoute(state.step)) showStep(state.step);
    }
    addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ const root=document.getElementById(ROOT_ID); if(root && !root.hidden){close(); e.preventDefault();}} },true);
    addEventListener('hashchange',()=>{
      const nextHashStep = parseHashStep();
      if (nextHashStep === null) return;
      writeState({status:'active',step:nextHashStep});
      showStep(nextHashStep);
    });
    addEventListener('resize',onResizeOrScroll,{passive:true});
    addEventListener('scroll',onResizeOrScroll,{passive:true});
    addEventListener('dpro:tutorial-state',updateLauncher);
    window.DPRO_TUTORIAL_CONSULT_V11 = Object.freeze({version:VERSION,steps:STEPS,start,resume,replay,close,skip,next,back,getState:readState,navigateToStep:navigateTo});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
