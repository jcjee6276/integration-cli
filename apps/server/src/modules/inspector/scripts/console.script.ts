/* eslint-disable */
/**
 * Console/Error 패널: 서버 CDP Runtime이 모은 console.* + uncaught 예외를
 * 노출 바인딩으로 폴링/초기화하고, 에러 클릭 시 서버가 소스맵으로 매핑해
 * Projects Code Viewer로 점프(inspector:element emit)한다.
 *
 * 주의: 인스펙트된 브라우저(페이지) 컨텍스트에서 실행되는 vanilla JS 문자열이다.
 */
export const CONSOLE_SCRIPT = `
(() => {
  try {
    if (window.__jcConsoleInstalled) return;
    window.__jcConsoleInstalled = true;

    var BTN_ID = '__jc-console-toggle';
    var PANEL_ID = '__jc-console-panel';
    var state = { open:false, errorsOnly:false, query:'', records:[] };

    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function levelColor(l){ return l==='error'||l==='exception'?'#ef4444':(l==='warning'?'#f59e0b':(l==='info'?'#60a5fa':(l==='debug'?'#9ca3af':'#cbd5e1'))); }
    function levelLabel(l){ return l==='exception'?'EXC':(l==='warning'?'WARN':l.toUpperCase()); }
    function baseName(u){ try { var p=u.split('?')[0].split('#')[0].split('/').filter(Boolean); return p[p.length-1]||u; } catch(e){ return u; } }
    function isErr(l){ return l==='error' || l==='exception'; }
    function matches(r){
      if(state.errorsOnly && !isErr(r.level)) return false;
      if(state.query && (r.text||'').toLowerCase().indexOf(state.query.toLowerCase())===-1) return false;
      return true;
    }
    function filterBtn(id, label, active){
      return '<button data-act="' + id + '" style="cursor:pointer;border:1px solid ' + (active?'rgba(16,185,129,0.5)':'rgba(255,255,255,0.12)') + ';background:' + (active?'rgba(16,185,129,0.15)':'transparent') + ';color:' + (active?'#34d399':'#9ca3af') + ';border-radius:6px;padding:3px 8px;font:600 11px/1 inherit">' + label + '</button>';
    }

    function ensureUi(){
      try {
        var btn=document.getElementById(BTN_ID);
        if(!btn){
          btn=document.createElement('button'); btn.id=BTN_ID; btn.type='button';
          btn.style.cssText='position:fixed;bottom:192px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:9999px;border:none;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#1f2937;cursor:pointer;box-shadow:0 6px 20px -6px rgba(0,0,0,0.5)';
          btn.textContent='🐞 Console';
          btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); state.open=!state.open; if(state.open){ try{ window.dispatchEvent(new CustomEvent('__jcPanelOpen',{detail:'console'})); }catch(e){} } renderPanel(); if(state.open) refresh(); });
          (document.body||document.documentElement).appendChild(btn);
        }
        var panel=document.getElementById(PANEL_ID);
        if(!panel){
          panel=document.createElement('div'); panel.id=PANEL_ID;
          panel.style.cssText='position:fixed;bottom:236px;right:16px;width:560px;max-width:92vw;max-height:58vh;z-index:2147483647;display:none;flex-direction:column;background:#0e1117;color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);font:12px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden';
          panel.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08)">' +
              '<span style="font-weight:700;color:#fff">Console</span>' +
              '<span id="__jc-console-filters" style="display:flex;gap:4px"></span>' +
              '<input id="__jc-console-search" placeholder="검색" style="margin-left:auto;width:120px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#e5e7eb;padding:3px 6px;font:11px/1 inherit;outline:none" />' +
              '<button data-act="clear" style="cursor:pointer;border:none;background:transparent;color:#9ca3af;font:600 11px/1 inherit">Clear</button>' +
              '<button data-act="close" style="cursor:pointer;border:none;background:transparent;color:#9ca3af;font:700 13px/1 inherit">✕</button>' +
            '</div>' +
            '<div id="__jc-console-list" style="overflow:auto;flex:1;min-height:80px"></div>';
          (document.body||document.documentElement).appendChild(panel);
          panel.addEventListener('click', onPanelClick, false);
          var search=panel.querySelector('#__jc-console-search');
          if(search) search.addEventListener('input', function(ev){ state.query=ev.target.value||''; renderList(); });
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
          else if(a==='clear'){ if(window.__jcConsoleClear) window.__jcConsoleClear(); state.records=[]; renderList(); }
          else if(a==='errors'){ state.errorsOnly=!state.errorsOnly; renderFilters(); renderList(); }
          return;
        }
        var row = ev.target && ev.target.closest ? ev.target.closest('[data-id]') : null;
        if(row){ ev.preventDefault(); ev.stopPropagation(); var id=row.getAttribute('data-id'); if(window.__jcConsoleOpen) window.__jcConsoleOpen(id); }
      } catch(e){}
    }

    function renderFilters(){
      try { var el=document.getElementById('__jc-console-filters'); if(el) el.innerHTML = filterBtn('errors','⚠ Errors', state.errorsOnly); } catch(e){}
    }

    function renderPanel(){
      try {
        var panel=ensureUi(); if(!panel) return;
        panel.style.display = state.open ? 'flex' : 'none';
        var btn=document.getElementById(BTN_ID); if(btn) btn.style.background = state.open ? '#059669' : '#1f2937';
        if(state.open){ renderFilters(); renderList(); }
      } catch(e){}
    }

    function renderList(){
      try {
        var list=document.getElementById('__jc-console-list'); if(!list) return;
        var rows=state.records.filter(matches);
        if(rows.length===0){ list.innerHTML='<div style="padding:16px;text-align:center;color:#6b7280">로그 없음</div>'; return; }
        var html='';
        for(var i=rows.length-1;i>=0;i--){
          var r=rows[i]; var c=levelColor(r.level); var loc = r.frame ? (esc(baseName(r.frame.url))+':'+r.frame.line) : '';
          html +=
            '<div ' + (r.frame?('data-id="'+esc(r.id)+'" style="cursor:pointer;"'):'style="cursor:default;"') + ' title="' + (r.frame?'클릭 시 소스로 이동':'') + '" class="__jc-c-row" data-row="1">' +
              '<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);border-left:2px solid '+c+'">' +
                '<span style="color:'+c+';font-weight:700;flex-shrink:0;width:40px">'+levelLabel(r.level)+'</span>' +
                '<span style="flex:1;min-width:0;white-space:pre-wrap;word-break:break-word">'+esc(r.text)+'</span>' +
                (loc?'<span style="color:#6b7280;flex-shrink:0">'+loc+'</span>':'') +
              '</div>' +
            '</div>';
        }
        list.innerHTML=html;
      } catch(e){}
    }

    async function refresh(){
      try { if(!window.__jcConsoleSync) return; var recs=await window.__jcConsoleSync(); state.records=Array.isArray(recs)?recs:[]; renderList(); } catch(e){}
    }

    window.addEventListener('__jcPanelOpen', function(e){ try { if(e.detail!=='console' && state.open){ state.open=false; renderPanel(); } } catch(err){} });

    ensureUi();
    setInterval(function(){ ensureUi(); if(state.open) refresh(); }, 1000);
  } catch (e) {}
})();
`;
