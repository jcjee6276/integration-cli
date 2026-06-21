/* eslint-disable */
/**
 * Network 패널: 서버 CDP가 모은 요청을 노출 바인딩으로 폴링/조회해
 * 목록·필터·상세(헤더/페이로드/응답/타이밍)·cURL 복사를 제공.
 *
 * 주의: 인스펙트된 브라우저(페이지) 컨텍스트에서 실행되는 vanilla JS 문자열이다.
 * 서버 빌드 타깃과 무관하므로 lint/타입체크 대상에서 제외한다.
 */
export const NETWORK_SCRIPT = `
(() => {
  try {
    if (window.__jcNetInstalled) return;
    window.__jcNetInstalled = true;

    var BS = String.fromCharCode(92);
    var BTN_ID = '__jc-net-toggle';
    var PANEL_ID = '__jc-net-panel';
    var state = { open:false, mode:'all', errorsOnly:false, query:'', expandedId:null, tab:'headers', records:[], bodies:{} };

    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function fmtBytes(n){ if(n==null) return '-'; if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
    function fmtMs(n){ if(n==null) return '-'; return Math.round(n)+' ms'; }
    function statusColor(r){ if(r.failed) return '#ef4444'; var s=r.status||0; if(s===0) return '#9ca3af'; if(s>=500) return '#ef4444'; if(s>=400) return '#f59e0b'; if(s>=300) return '#3b82f6'; return '#10b981'; }
    function shq(s){ return "'" + String(s==null?'':s).split("'").join("'"+BS+"''") + "'"; }
    function prettyMaybe(text, mime){ try { if(mime && mime.indexOf('json')!==-1) return JSON.stringify(JSON.parse(text), null, 2); return text; } catch(e){ return text; } }

    function matches(r){
      if(state.mode==='fetchxhr'){ var t=(r.type||'').toLowerCase(); if(t!=='fetch'&&t!=='xhr') return false; }
      if(state.errorsOnly){ if(!r.failed && (r.status||0)<400) return false; }
      if(state.query){ var q=state.query.toLowerCase(); if((r.url||'').toLowerCase().indexOf(q)===-1) return false; }
      return true;
    }

    function filterBtn(id, label, active){
      return '<button data-act="' + id + '" style="cursor:pointer;border:1px solid ' + (active?'rgba(16,185,129,0.5)':'rgba(255,255,255,0.12)') + ';background:' + (active?'rgba(16,185,129,0.15)':'transparent') + ';color:' + (active?'#34d399':'#9ca3af') + ';border-radius:6px;padding:3px 8px;font:600 11px/1 inherit">' + label + '</button>';
    }

    function ensureUi(){
      try {
        var btn = document.getElementById(BTN_ID);
        if(!btn){
          btn = document.createElement('button');
          btn.id = BTN_ID; btn.type='button';
          btn.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:9999px;border:none;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#1f2937;cursor:pointer;box-shadow:0 6px 20px -6px rgba(0,0,0,0.5)';
          btn.textContent = '🌐 Network';
          btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); state.open=!state.open; if(state.open){ try{ window.dispatchEvent(new CustomEvent('__jcPanelOpen',{detail:'net'})); }catch(e){} } renderPanel(); if(state.open) refresh(); });
          (document.body||document.documentElement).appendChild(btn);
        }
        var panel = document.getElementById(PANEL_ID);
        if(!panel){
          panel = document.createElement('div');
          panel.id = PANEL_ID;
          panel.style.cssText = 'position:fixed;bottom:236px;right:16px;width:560px;max-width:92vw;max-height:60vh;z-index:2147483647;display:none;flex-direction:column;background:#0e1117;color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);font:12px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden';
          panel.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08)">' +
              '<span style="font-weight:700;color:#fff">Network</span>' +
              '<span id="__jc-net-filters" style="display:flex;gap:4px"></span>' +
              '<input id="__jc-net-search" placeholder="URL 검색" style="margin-left:auto;width:120px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#e5e7eb;padding:3px 6px;font:11px/1 inherit;outline:none" />' +
              '<button data-act="clear" style="cursor:pointer;border:none;background:transparent;color:#9ca3af;font:600 11px/1 inherit">Clear</button>' +
              '<button data-act="close" style="cursor:pointer;border:none;background:transparent;color:#9ca3af;font:700 13px/1 inherit">✕</button>' +
            '</div>' +
            '<div id="__jc-net-list" style="overflow:auto;flex:1;min-height:80px"></div>' +
            '<div id="__jc-net-detail" style="border-top:1px solid rgba(255,255,255,0.08);max-height:40vh;overflow:auto;display:none"></div>';
          (document.body||document.documentElement).appendChild(panel);

          panel.addEventListener('click', onPanelClick, false);
          var search = panel.querySelector('#__jc-net-search');
          if(search) search.addEventListener('input', function(ev){ state.query = ev.target.value || ''; renderList(); });
        }
        return panel;
      } catch(e){ return null; }
    }

    function onPanelClick(ev){
      try {
        var act = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
        if(act){
          ev.preventDefault(); ev.stopPropagation();
          var a = act.getAttribute('data-act');
          if(a==='close'){ state.open=false; renderPanel(); return; }
          if(a==='clear'){ if(window.__jcNetClear) window.__jcNetClear(); state.records=[]; state.expandedId=null; renderList(); renderDetail(); return; }
          if(a==='all'){ state.mode='all'; renderFilters(); renderList(); return; }
          if(a==='fetchxhr'){ state.mode = state.mode==='fetchxhr'?'all':'fetchxhr'; renderFilters(); renderList(); return; }
          if(a==='errors'){ state.errorsOnly=!state.errorsOnly; renderFilters(); renderList(); return; }
          if(a==='curl'){ copyCurl(state.expandedId); return; }
          if(a && a.indexOf('tab:')===0){ state.tab=a.slice(4); renderDetail(); return; }
          return;
        }
        var row = ev.target && ev.target.closest ? ev.target.closest('[data-id]') : null;
        if(row){
          ev.preventDefault(); ev.stopPropagation();
          var id = row.getAttribute('data-id');
          state.expandedId = state.expandedId===id ? null : id;
          renderList(); renderDetail();
        }
      } catch(e){}
    }

    function renderFilters(){
      try {
        var el = document.getElementById('__jc-net-filters');
        if(!el) return;
        el.innerHTML = filterBtn('all','All', state.mode==='all') + filterBtn('fetchxhr','Fetch/XHR', state.mode==='fetchxhr') + filterBtn('errors','⚠ Errors', state.errorsOnly);
      } catch(e){}
    }

    function renderPanel(){
      try {
        var panel = ensureUi();
        if(!panel) return;
        panel.style.display = state.open ? 'flex' : 'none';
        var btn = document.getElementById(BTN_ID);
        if(btn) btn.style.background = state.open ? '#059669' : '#1f2937';
        if(state.open){ renderFilters(); renderList(); renderDetail(); }
      } catch(e){}
    }

    function renderList(){
      try {
        var list = document.getElementById('__jc-net-list');
        if(!list) return;
        var rows = state.records.filter(matches);
        if(rows.length===0){ list.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280">요청 없음</div>'; return; }
        var html = '';
        for(var i=0;i<rows.length;i++){
          var r = rows[i];
          var sel = r.id===state.expandedId;
          html +=
            '<div data-id="' + esc(r.id) + '" style="display:grid;grid-template-columns:46px 44px 1fr 56px 60px 56px;gap:6px;align-items:center;padding:5px 10px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);' + (sel?'background:rgba(16,185,129,0.10)':'') + '">' +
              '<span style="color:#9ca3af;font-weight:600">' + esc(r.method||'') + '</span>' +
              '<span style="color:' + statusColor(r) + ';font-weight:700">' + esc(r.failed?'ERR':(r.status||'...')) + '</span>' +
              '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.url||'') + '">' + esc(r.name||r.url||'') + '</span>' +
              '<span style="color:#6b7280">' + esc((r.type||'').toLowerCase()) + '</span>' +
              '<span style="color:#9ca3af;text-align:right">' + fmtMs(r.durationMs) + '</span>' +
              '<span style="color:#9ca3af;text-align:right">' + fmtBytes(r.size) + '</span>' +
            '</div>';
        }
        list.innerHTML = html;
      } catch(e){}
    }

    function headerLines(obj){
      try { if(!obj) return '<div style="color:#6b7280">(없음)</div>'; var k, out=''; for(k in obj){ out += '<div style="display:flex;gap:6px;padding:1px 0"><span style="color:#60a5fa;min-width:120px;flex-shrink:0">' + esc(k) + '</span><span style="word-break:break-all">' + esc(obj[k]) + '</span></div>'; } return out||'<div style="color:#6b7280">(없음)</div>'; } catch(e){ return ''; }
    }

    function timingBars(t){
      try {
        if(!t) return '<div style="color:#6b7280">타이밍 정보 없음</div>';
        var parts = [['DNS',t.dns,'#a78bfa'],['Connect',t.connect,'#60a5fa'],['SSL',t.ssl,'#f472b6'],['Send',t.send,'#34d399'],['Wait(TTFB)',t.wait,'#fbbf24']];
        var max = 1; for(var i=0;i<parts.length;i++){ if(parts[i][1]>max) max=parts[i][1]; }
        var out = '';
        for(var j=0;j<parts.length;j++){ var w = Math.max(2, Math.round(parts[j][1]/max*200)); out += '<div style="display:flex;align-items:center;gap:8px;padding:2px 0"><span style="width:90px;color:#9ca3af">' + parts[j][0] + '</span><span style="height:10px;width:' + w + 'px;background:' + parts[j][2] + ';border-radius:2px"></span><span style="color:#9ca3af">' + fmtMs(parts[j][1]) + '</span></div>'; }
        out += '<div style="margin-top:6px;color:#e5e7eb;font-weight:600">Total ' + fmtMs(t.total) + '</div>';
        return out;
      } catch(e){ return ''; }
    }

    function renderDetail(){
      try {
        var detail = document.getElementById('__jc-net-detail');
        if(!detail) return;
        if(!state.expandedId){ detail.style.display='none'; detail.innerHTML=''; return; }
        var r = null; for(var i=0;i<state.records.length;i++){ if(state.records[i].id===state.expandedId){ r=state.records[i]; break; } }
        if(!r){ detail.style.display='none'; detail.innerHTML=''; return; }
        detail.style.display='block';
        function tabBtn(id,label){ var on = state.tab===id; return '<button data-act="tab:' + id + '" style="cursor:pointer;border:none;background:transparent;border-bottom:2px solid ' + (on?'#10b981':'transparent') + ';color:' + (on?'#fff':'#9ca3af') + ';padding:6px 8px;font:600 11px/1 inherit">' + label + '</button>'; }
        var body = '';
        if(state.tab==='headers'){
          body =
            '<div style="margin-bottom:6px"><span style="color:#6b7280">URL </span>' + esc(r.url||'') + '</div>' +
            '<div style="margin-bottom:6px"><span style="color:#6b7280">Method </span>' + esc(r.method||'') + '<span style="color:#6b7280"> · Status </span><span style="color:' + statusColor(r) + '">' + esc((r.status||'') + ' ' + (r.statusText||'')) + '</span>' + (r.errorText?'<span style="color:#ef4444"> · ' + esc(r.errorText) + '</span>':'') + '</div>' +
            '<div style="color:#fff;font-weight:600;margin:8px 0 2px">Response Headers</div>' + headerLines(r.responseHeaders) +
            '<div style="color:#fff;font-weight:600;margin:8px 0 2px">Request Headers</div>' + headerLines(r.requestHeaders);
        } else if(state.tab==='payload'){
          body = r.postData ? '<pre style="white-space:pre-wrap;word-break:break-all;margin:0">' + esc(prettyMaybe(r.postData, 'application/json')) + '</pre>' : '<div style="color:#6b7280">요청 본문 없음</div>';
        } else if(state.tab==='response'){
          var cached = state.bodies[r.id];
          if(cached===undefined){ fetchBody(r.id); body = '<div style="color:#6b7280">불러오는 중...</div>'; }
          else if(cached && cached.base64Encoded && (r.mime||'').indexOf('image/')===0){ body = '<img src="data:' + esc(r.mime) + ';base64,' + esc(cached.body) + '" style="max-width:100%" />'; }
          else if(cached){ body = '<pre style="white-space:pre-wrap;word-break:break-all;margin:0">' + esc(prettyMaybe(cached.body, r.mime)) + '</pre>'; }
          else { body = '<div style="color:#6b7280">본문을 가져올 수 없음</div>'; }
        } else if(state.tab==='timing'){
          body = timingBars(r.timing);
        }
        detail.innerHTML =
          '<div style="display:flex;align-items:center;gap:2px;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;background:#0e1117">' +
            tabBtn('headers','Headers') + tabBtn('payload','Payload') + tabBtn('response','Response') + tabBtn('timing','Timing') +
            '<button data-act="curl" style="margin-left:auto;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;border-radius:6px;padding:3px 8px;font:600 11px/1 inherit">Copy as cURL</button>' +
          '</div>' +
          '<div style="padding:8px 10px">' + body + '</div>';
      } catch(e){}
    }

    function fetchBody(id){
      try {
        if(state.bodies[id]!==undefined) return;
        state.bodies[id] = null;
        if(!window.__jcNetBody){ return; }
        Promise.resolve(window.__jcNetBody(id)).then(function(res){ state.bodies[id] = res || { body:'', base64Encoded:false }; if(state.expandedId===id && state.tab==='response') renderDetail(); }).catch(function(){});
      } catch(e){}
    }

    function copyCurl(id){
      try {
        if(!id) return; var r=null; for(var i=0;i<state.records.length;i++){ if(state.records[i].id===id){ r=state.records[i]; break; } }
        if(!r) return;
        var parts = ['curl ' + shq(r.url||'')];
        if(r.method && r.method!=='GET') parts.push('-X ' + r.method);
        var h = r.requestHeaders||{}; var k;
        for(k in h){ parts.push('-H ' + shq(k + ': ' + h[k])); }
        if(r.postData) parts.push('--data-raw ' + shq(r.postData));
        var cmd = parts.join(' ' + BS + String.fromCharCode(10) + '  ');
        if(navigator.clipboard) navigator.clipboard.writeText(cmd);
      } catch(e){}
    }

    async function refresh(){
      try {
        if(!window.__jcNetSync) return;
        var recs = await window.__jcNetSync();
        state.records = Array.isArray(recs) ? recs : [];
        renderList();
        if(state.expandedId){ var still=false; for(var i=0;i<state.records.length;i++){ if(state.records[i].id===state.expandedId){ still=true; break; } } if(still) renderDetail(); }
      } catch(e){}
    }

    window.addEventListener('__jcPanelOpen', function(e){ try { if(e.detail!=='net' && state.open){ state.open=false; renderPanel(); } } catch(err){} });

    ensureUi();
    setInterval(function(){ ensureUi(); if(state.open) refresh(); }, 1000);
  } catch (e) {}
})();
`;
