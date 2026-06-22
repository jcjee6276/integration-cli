/* eslint-disable */
/**
 * React 렌더 모니터: DevTools 전역 훅을 가로채 커밋마다 렌더된 컴포넌트를 수집,
 * 리렌더 하이라이트 / 횟수 랭킹 / 커밋별 렌더 순서를 제공.
 *
 * 주의: 인스펙트된 브라우저(페이지) 컨텍스트에서 실행되는 vanilla JS 문자열이다.
 * 서버 빌드 타깃과 무관하므로 lint/타입체크 대상에서 제외한다.
 */
export const REACT_SCRIPT = `
(() => {
  try {
    if (window.__jcReactInstalled) return;
    window.__jcReactInstalled = true;

    var PERFORMED_WORK = 1;
    var BTN_ID = '__jc-react-toggle';
    var PANEL_ID = '__jc-react-panel';
    var HL_ID = '__jc-react-hl';
    var TOOLBAR_ID = '__jc-inspect-toolbox';
    var state = { open:false, highlight:true, commits:[], counts:{}, total:0, expanded:null };

    function compName(fiber){
      try {
        var t = fiber.type; if(t==null) return null;
        if(typeof t==='function') return t.displayName || t.name || 'Anonymous';
        if(typeof t==='object'){
          if(t.displayName) return t.displayName;
          if(t.render) return t.render.displayName || t.render.name || 'ForwardRef';
          if(t.type) return (t.type.displayName || t.type.name || 'Memo');
        }
        return null;
      } catch(e){ return null; }
    }
    function nearestHost(fiber){
      try { var n=fiber.child, guard=0; var stack=[]; while(n && guard++<4000){ if(n.stateNode && n.stateNode.nodeType===1) return n.stateNode; if(n.sibling) stack.push(n.sibling); n = n.child || stack.pop() || null; } } catch(e){}
      return null;
    }
    function traverse(root, visit){
      var node = root, depth = 0;
      while(node){
        visit(node, depth);
        if(node.child){ node = node.child; depth++; continue; }
        if(node===root) return;
        while(!node.sibling){ if(!node.return || node.return===root) return; node = node.return; depth--; }
        node = node.sibling;
      }
    }

    function ensureHl(){ var c=document.getElementById(HL_ID); if(!c){ c=document.createElement('div'); c.id=HL_ID; c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483646'; (document.body||document.documentElement).appendChild(c); } return c; }
    function heatColor(h){ return h<5?'#10b981':(h<20?'#f59e0b':'#ef4444'); }
    function flashAll(nodes){
      try {
        var c=ensureHl(); var seen=[]; var cnt=0;
        for(var i=0;i<nodes.length && cnt<40;i++){
          var node=nodes[i].node; if(!node || seen.indexOf(node)!==-1) continue; seen.push(node); cnt++;
          var r=node.getBoundingClientRect(); if(r.width<=0 && r.height<=0) continue;
          var d=document.createElement('div');
          d.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+Math.max(0,r.width)+'px;height:'+Math.max(0,r.height)+'px;border:1.5px solid '+heatColor(nodes[i].heat)+';border-radius:2px;box-sizing:border-box;transition:opacity 420ms ease-out;opacity:0.9';
          c.appendChild(d);
          (function(el){ requestAnimationFrame(function(){ el.style.opacity='0'; }); setTimeout(function(){ try{ el.remove(); }catch(e){} }, 480); })(d);
        }
      } catch(e){}
    }

    function collect(root){
      try {
        if(!root || !root.current) return;
        var items=[]; var nodes=[];
        traverse(root.current, function(fiber, depth){
          if(((fiber.flags||0) & PERFORMED_WORK) !== PERFORMED_WORK) return;
          var name = compName(fiber);
          if(!name) return;
          state.counts[name] = (state.counts[name]||0) + 1;
          if(items.length<80) items.push({ name:name, self: Math.round((fiber.actualDuration||0)*100)/100, depth: Math.min(depth,12) });
          var host = (fiber.stateNode && fiber.stateNode.nodeType===1) ? fiber.stateNode : nearestHost(fiber);
          if(host) nodes.push({ node:host, heat: state.counts[name] });
        });
        if(items.length===0) return;
        state.total++;
        state.commits.push({ t: Date.now(), n: items.length, items: items });
        if(state.commits.length>40) state.commits.shift();
        if(state.highlight) flashAll(nodes);
        if(state.open) renderBody();
      } catch(e){}
    }

    // ── DevTools 전역 훅 가로채기 (React보다 먼저) ────────────────────────────
    var existing = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if(existing){
      var orig = existing.onCommitFiberRoot;
      existing.onCommitFiberRoot = function(id, root, pri, err){ collect(root); if(typeof orig==='function') return orig.call(existing, id, root, pri, err); };
    } else {
      var renderers = new Map(); var nextID = 0;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber:true, renderers:renderers,
        inject:function(r){ var id=++nextID; renderers.set(id,r); return id; },
        onCommitFiberRoot:function(id, root){ collect(root); },
        onCommitFiberUnmount:function(){}, onPostCommitFiberRoot:function(){},
        on:function(){}, sub:function(){ return function(){}; }, emit:function(){},
        getFiberRoots:function(){ return new Set(); }, checkDCE:function(){}, isDisabled:false
      };
    }

    // ── 패널 UI ──────────────────────────────────────────────────────────────
    function ensureToolbar(){
      var bar = document.getElementById(TOOLBAR_ID);
      if(!bar){
        bar = document.createElement('div');
        bar.id = TOOLBAR_ID;
        bar.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:2147483647;display:flex;align-items:center;gap:4px;padding:4px;border-radius:9999px;background:rgba(17,24,39,0.86);border:1px solid rgba(255,255,255,0.10);box-shadow:0 8px 24px -10px rgba(0,0,0,0.65);backdrop-filter:blur(10px)';
        (document.body||document.documentElement).appendChild(bar);
      }
      return bar;
    }

    function renderButton(){
      var btn = document.getElementById(BTN_ID);
      if(!btn) return;
      btn.textContent = state.open ? '⚛️ React' : '⚛️';
      btn.title = 'React';
      btn.style.background = state.open ? '#059669' : 'transparent';
      btn.style.color = '#fff';
      btn.style.minWidth = state.open ? '82px' : '32px';
      btn.style.order = '3';
    }

    function ensureUi(){
      try {
        var btn=document.getElementById(BTN_ID);
        if(!btn){
          btn=document.createElement('button'); btn.id=BTN_ID; btn.type='button';
          btn.style.cssText='height:32px;min-width:32px;padding:0 9px;border-radius:9999px;border:none;font:700 12px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer;transition:all 140ms ease;white-space:nowrap';
          btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); state.open=!state.open; if(state.open){ try{ window.dispatchEvent(new CustomEvent('__jcPanelOpen',{detail:'react'})); }catch(e){} } renderPanel(); });
          ensureToolbar().appendChild(btn);
        }
        renderButton();
        var panel=document.getElementById(PANEL_ID);
        if(!panel){
          panel=document.createElement('div'); panel.id=PANEL_ID;
          panel.style.cssText='position:fixed;bottom:112px;right:16px;width:420px;max-width:92vw;max-height:60vh;z-index:2147483647;display:none;flex-direction:column;background:#0e1117;color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);font:12px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden';
          panel.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08)">' +
              '<span style="font-weight:700;color:#fff">React 렌더</span>' +
              '<button data-act="hl" style="cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:transparent;border-radius:6px;padding:3px 8px;font:600 11px/1 inherit">하이라이트</button>' +
              '<button data-act="reset" style="margin-left:auto;cursor:pointer;border:none;background:transparent;color:#9ca3af;font:600 11px/1 inherit">리셋</button>' +
              '<button data-act="close" style="cursor:pointer;border:none;background:transparent;color:#9ca3af;font:700 13px/1 inherit">✕</button>' +
            '</div>' +
            '<div id="__jc-react-body" style="overflow:auto;padding:10px"></div>';
          (document.body||document.documentElement).appendChild(panel);
          panel.addEventListener('click', onPanelClick, false);
        }
        return panel;
      } catch(e){ return null; }
    }

    function onPanelClick(ev){
      try {
        var act = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
        if(act){
          ev.preventDefault(); ev.stopPropagation();
          var a=act.getAttribute('data-act');
          if(a==='close'){ state.open=false; renderPanel(); }
          else if(a==='hl'){ state.highlight=!state.highlight; renderBody(); }
          else if(a==='reset'){ state.counts={}; state.commits=[]; state.total=0; state.expanded=null; renderBody(); }
          return;
        }
        var row = ev.target && ev.target.closest ? ev.target.closest('[data-ci]') : null;
        if(row){ ev.preventDefault(); ev.stopPropagation(); var ci=row.getAttribute('data-ci'); state.expanded = state.expanded===ci ? null : ci; renderBody(); }
      } catch(e){}
    }

    function renderPanel(){
      try {
        var panel=ensureUi(); if(!panel) return;
        panel.style.display = state.open ? 'flex' : 'none';
        renderButton();
        if(state.open) renderBody();
      } catch(e){}
    }

    function renderBody(){
      try {
        var body=document.getElementById('__jc-react-body'); if(!body) return;
        var hlBtn = document.querySelector('#'+PANEL_ID+' [data-act="hl"]');
        if(hlBtn){ hlBtn.style.color = state.highlight ? '#34d399' : '#9ca3af'; hlBtn.style.borderColor = state.highlight ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.12)'; hlBtn.textContent = state.highlight ? '하이라이트 ON' : '하이라이트 OFF'; }

        var names = Object.keys(state.counts).sort(function(a,b){ return state.counts[b]-state.counts[a]; }).slice(0,15);
        var maxC = names.length ? state.counts[names[0]] : 1;
        var ranking = '';
        for(var i=0;i<names.length;i++){
          var nm=names[i]; var c=state.counts[nm]; var w=Math.max(4, Math.round(c/maxC*150)); var col = c<5?'#10b981':(c<20?'#f59e0b':'#ef4444');
          ranking += '<div style="display:flex;align-items:center;gap:8px;padding:2px 0"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(nm)+'</span><span style="height:9px;width:'+w+'px;background:'+col+';border-radius:2px"></span><span style="color:#9ca3af;width:34px;text-align:right">'+c+'</span></div>';
        }
        if(!ranking) ranking = '<div style="color:#6b7280">아직 렌더 없음 — 앱과 상호작용해 보세요</div>';

        var commitsHtml = '';
        var cs = state.commits.slice(-15).reverse();
        for(var j=0;j<cs.length;j++){
          var idx = String(state.commits.length-1-j); var cm=cs[j]; var open = state.expanded===idx;
          commitsHtml += '<div data-ci="'+idx+'" style="cursor:pointer;padding:3px 0;border-top:1px solid rgba(255,255,255,0.05)"><span style="color:#9ca3af">'+(open?'▾':'▸')+'</span> <b>'+cm.n+'</b>개 렌더 · <span style="color:#6b7280">'+ago(cm.t)+'</span></div>';
          if(open){
            var its=''; for(var k=0;k<cm.items.length;k++){ var it=cm.items[k]; its += '<div style="padding:1px 0;padding-left:'+(8+it.depth*8)+'px;color:#cbd5e1">'+esc(it.name)+(it.self>0?' <span style="color:#6b7280">'+it.self+'ms</span>':'')+'</div>'; }
            commitsHtml += '<div style="margin:2px 0 6px">'+its+'</div>';
          }
        }
        if(!commitsHtml) commitsHtml = '<div style="color:#6b7280">커밋 없음</div>';

        body.innerHTML =
          '<div style="color:#fff;font-weight:600;margin:0 0 4px">리렌더 횟수 (Top)</div>' + ranking +
          '<div style="color:#fff;font-weight:600;margin:12px 0 4px">최근 커밋 (렌더 순서)</div>' + commitsHtml +
          '<div style="color:#6b7280;margin-top:10px;font-size:11px">* dev 빌드 기준. self 시간은 Profiler 타이머가 꺼져 있으면 표시되지 않습니다.</div>';
      } catch(e){}
    }

    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function ago(t){ var s=Math.round((Date.now()-t)/1000); if(s<1) return '방금'; if(s<60) return s+'초 전'; return Math.round(s/60)+'분 전'; }

    window.addEventListener('__jcPanelOpen', function(e){ try { if(e.detail!=='react' && state.open){ state.open=false; renderPanel(); } } catch(err){} });

    ensureUi();
    setInterval(function(){ ensureUi(); if(state.open) renderBody(); }, 1000);
  } catch (e) {}
})();
`;
