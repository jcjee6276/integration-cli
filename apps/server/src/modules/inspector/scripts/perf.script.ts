/* eslint-disable */
/**
 * Performance 패널: in-page PerformanceObserver로 Core Web Vitals + 로드 타이밍 +
 * 메모리/리소스 요약 측정.
 *
 * 주의: 인스펙트된 브라우저(페이지) 컨텍스트에서 실행되는 vanilla JS 문자열이다.
 * 서버 빌드 타깃과 무관하므로 lint/타입체크 대상에서 제외한다.
 */
export const PERF_SCRIPT = `
(() => {
  try {
    if (window.__jcPerfInstalled) return;
    window.__jcPerfInstalled = true;

    var BTN_ID = '__jc-perf-toggle';
    var PANEL_ID = '__jc-perf-panel';
    var vitals = { lcp:null, cls:0, inp:null, fcp:null };
    var state = { open:false };

    function obs(type, cb, extra){
      try {
        var o = new PerformanceObserver(function(list){ list.getEntries().forEach(cb); });
        var opt = { type:type, buffered:true };
        if(extra){ for(var k in extra) opt[k]=extra[k]; }
        o.observe(opt);
      } catch(e){}
    }
    obs('largest-contentful-paint', function(e){ vitals.lcp = e.renderTime || e.loadTime || e.startTime; });
    obs('layout-shift', function(e){ if(!e.hadRecentInput) vitals.cls += e.value; });
    obs('paint', function(e){ if(e.name==='first-contentful-paint') vitals.fcp = e.startTime; });
    obs('event', function(e){ var d=e.duration; if(vitals.inp==null || d>vitals.inp) vitals.inp = d; }, { durationThreshold:40 });

    function nav(){ try { return performance.getEntriesByType('navigation')[0] || null; } catch(e){ return null; } }
    function ttfb(){ var n=nav(); return n ? n.responseStart : null; }
    function rate(metric, v){
      if(v==null) return 'na';
      var th = { lcp:[2500,4000], fcp:[1800,3000], inp:[200,500], ttfb:[800,1800], cls:[0.1,0.25] }[metric];
      if(!th) return 'na';
      if(v<=th[0]) return 'good'; if(v<=th[1]) return 'ni'; return 'poor';
    }
    function rateColor(r){ return r==='good'?'#10b981':r==='ni'?'#f59e0b':r==='poor'?'#ef4444':'#6b7280'; }
    function fmt(metric, v){ if(v==null) return '-'; if(metric==='cls') return v.toFixed(3); return Math.round(v)+' ms'; }
    function memInfo(){ try { var m=performance.memory; return m ? (m.usedJSHeapSize/1048576).toFixed(1)+' / '+(m.jsHeapSizeLimit/1048576).toFixed(0)+' MB' : '-'; } catch(e){ return '-'; } }
    function domNodes(){ try { return String(document.getElementsByTagName('*').length); } catch(e){ return '-'; } }
    function resSummary(){ try { var rs=performance.getEntriesByType('resource'); var sum=0; for(var i=0;i<rs.length;i++) sum+=(rs[i].transferSize||0); return rs.length+' / '+(sum/1024).toFixed(0)+' KB'; } catch(e){ return '-'; } }

    function card(label, metric, v){
      var r = rate(metric, v); var c = rateColor(r);
      var badge = r==='na' ? '' : '<span style="font-size:9px;color:'+c+';border:1px solid '+c+';border-radius:4px;padding:1px 4px;margin-left:6px">'+(r==='good'?'GOOD':r==='ni'?'OK':'POOR')+'</span>';
      return '<div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;flex:1;min-width:92px"><div style="color:#9ca3af;font-size:11px">'+label+badge+'</div><div style="font-weight:700;font-size:16px;color:'+c+'">'+fmt(metric, v)+'</div></div>';
    }
    function infoRow(label, val){
      return '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#9ca3af">'+label+'</span><span>'+val+'</span></div>';
    }

    function ensureUi(){
      try {
        var btn = document.getElementById(BTN_ID);
        if(!btn){
          btn = document.createElement('button');
          btn.id = BTN_ID; btn.type='button';
          btn.style.cssText = 'position:fixed;bottom:104px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:9999px;border:none;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#1f2937;cursor:pointer;box-shadow:0 6px 20px -6px rgba(0,0,0,0.5)';
          btn.textContent = '📊 Perf';
          btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); state.open=!state.open; if(state.open){ try{ window.dispatchEvent(new CustomEvent('__jcPanelOpen',{detail:'perf'})); }catch(e){} } renderPanel(); });
          (document.body||document.documentElement).appendChild(btn);
        }
        var panel = document.getElementById(PANEL_ID);
        if(!panel){
          panel = document.createElement('div');
          panel.id = PANEL_ID;
          panel.style.cssText = 'position:fixed;bottom:192px;right:16px;width:440px;max-width:92vw;max-height:60vh;z-index:2147483647;display:none;flex-direction:column;background:#0e1117;color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);font:12px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden';
          panel.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08)">' +
              '<span style="font-weight:700;color:#fff">Performance</span>' +
              '<button data-act="refresh" style="margin-left:auto;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;border-radius:6px;padding:3px 8px;font:600 11px/1 inherit">새로고침</button>' +
              '<button data-act="close" style="cursor:pointer;border:none;background:transparent;color:#9ca3af;font:700 13px/1 inherit">✕</button>' +
            '</div>' +
            '<div id="__jc-perf-body" style="overflow:auto;padding:10px"></div>';
          (document.body||document.documentElement).appendChild(panel);
          panel.addEventListener('click', function(ev){
            try {
              var act = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
              if(!act) return;
              ev.preventDefault(); ev.stopPropagation();
              var a = act.getAttribute('data-act');
              if(a==='close'){ state.open=false; renderPanel(); }
              else if(a==='refresh'){ renderBody(); }
            } catch(e){}
          }, false);
        }
        return panel;
      } catch(e){ return null; }
    }

    function renderBody(){
      try {
        var body = document.getElementById('__jc-perf-body');
        if(!body) return;
        var n = nav();
        var d = function(a,b){ return (n && n[b]>=0 && n[a]>=0 && n[b]>=n[a]) ? Math.round(n[b]-n[a]) : null; };
        var timing = n ? (
          infoRow('DNS', (d('domainLookupStart','domainLookupEnd')!=null? d('domainLookupStart','domainLookupEnd')+' ms':'-')) +
          infoRow('TCP', (d('connectStart','connectEnd')!=null? d('connectStart','connectEnd')+' ms':'-')) +
          infoRow('Request', (d('requestStart','responseStart')!=null? d('requestStart','responseStart')+' ms':'-')) +
          infoRow('Response', (d('responseStart','responseEnd')!=null? d('responseStart','responseEnd')+' ms':'-')) +
          infoRow('DOMContentLoaded', (n.domContentLoadedEventEnd? Math.round(n.domContentLoadedEventEnd)+' ms':'-')) +
          infoRow('Load', (n.loadEventEnd? Math.round(n.loadEventEnd)+' ms':'-'))
        ) : '<div style="color:#6b7280">네비게이션 타이밍 없음</div>';

        body.innerHTML =
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            card('LCP','lcp',vitals.lcp) + card('INP','inp',vitals.inp) + card('CLS','cls',vitals.cls) +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
            card('FCP','fcp',vitals.fcp) + card('TTFB','ttfb',ttfb()) +
          '</div>' +
          '<div style="color:#fff;font-weight:600;margin:12px 0 4px">로드 타이밍</div>' + timing +
          '<div style="color:#fff;font-weight:600;margin:12px 0 4px">리소스 / 메모리</div>' +
          infoRow('JS Heap', memInfo()) + infoRow('DOM 노드', domNodes()) + infoRow('리소스 수 / 전송량', resSummary()) +
          '<div style="color:#6b7280;margin-top:10px;font-size:11px">* 값은 페이지 로드 이후 누적됩니다. 상호작용/스크롤 후 INP·CLS가 갱신됩니다.</div>';
      } catch(e){}
    }

    function renderPanel(){
      try {
        var panel = ensureUi();
        if(!panel) return;
        panel.style.display = state.open ? 'flex' : 'none';
        var btn = document.getElementById(BTN_ID);
        if(btn) btn.style.background = state.open ? '#059669' : '#1f2937';
        if(state.open) renderBody();
      } catch(e){}
    }

    window.addEventListener('__jcPanelOpen', function(e){ try { if(e.detail!=='perf' && state.open){ state.open=false; renderPanel(); } } catch(err){} });

    ensureUi();
    setInterval(function(){ ensureUi(); if(state.open) renderBody(); }, 1000);
  } catch (e) {}
})();
`;
