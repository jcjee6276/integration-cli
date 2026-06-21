import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser, CDPSession, Page } from 'puppeteer-core';
import { SourceMapConsumer } from 'source-map';
import type { RawIndexMap, RawSourceMap } from 'source-map';

export type InspectorState = 'idle' | 'connecting' | 'active';

/** CDP Network 도메인에서 누적하는 요청 레코드 */
interface NetRecord {
  id: string;
  method?: string;
  url?: string;
  name?: string;
  type?: string;
  status?: number;
  statusText?: string;
  mime?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  startTime?: number;
  durationMs?: number;
  size?: number;
  failed?: boolean;
  errorText?: string;
  done?: boolean;
  timing?: {
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    total: number;
  } | null;
}

const MAX_NET_RECORDS = 500;

/** in-page 헬퍼가 보내는 원시 payload */
interface InspectorRawPayload {
  source?: { fileName: string; lineNumber?: number; columnNumber?: number };
  frame?: { url: string; line: number; column: number };
  componentName?: string;
  notFound?: boolean;
  tagName?: string;
  text?: string;
}

export interface InspectorElementEvent {
  /** source map으로 resolve된 절대경로. notFound면 undefined */
  fileName?: string;
  line?: number;
  column?: number;
  /** JSX 요소가 끝나는 줄 (AST 파싱 성공 시). 범위 하이라이트용 */
  endLine?: number;
  componentName?: string;
  /** resolve 실패 시 true — 텍스트/태그만 전달 */
  notFound?: boolean;
  tagName?: string;
  text?: string;
}

export interface InspectorStatusEvent {
  state: InspectorState;
  appUrl?: string;
  error?: string;
}

const BINDING_NAME = '__jcInspect';

/**
 * 클릭한 DOM에서 React fiber의 _debugStack(번들 위치) + _debugOwner(컴포넌트명)을
 * 추출하는 in-page overlay 헬퍼. addScriptToEvaluateOnNewDocument + 현재 페이지 즉시 주입.
 * 번들 위치 → 원본 파일/라인 매핑은 서버에서 source map으로 수행.
 *
 * - mousemove: hover outline
 * - click(capture): fiber 탐색 → { frame, componentName } → window.__jcInspect(payload)
 * - 우하단 토글 pill / Esc: 캡처 ON·OFF (OFF면 페이지 정상 동작)
 */
const OVERLAY_SCRIPT = `
(() => {
  try {
    if (window.__jcInspectInstalled) return;
    window.__jcInspectInstalled = true;

    const HL_ID = '__jc-inspect-highlight';
    function ensureHighlight() {
      let el = document.getElementById(HL_ID);
      if (!el) {
        el = document.createElement('div');
        el.id = HL_ID;
        el.style.cssText = [
          'position:fixed',
          'z-index:2147483647',
          'pointer-events:none',
          'background:rgba(16,185,129,0.18)',
          'border:1px solid rgba(16,185,129,0.85)',
          'border-radius:2px',
          'transition:all 40ms ease-out',
          'display:none',
        ].join(';');
        document.documentElement.appendChild(el);
      }
      return el;
    }

    function moveHighlight(target) {
      try {
        const el = ensureHighlight();
        if (!target || !target.getBoundingClientRect) {
          el.style.display = 'none';
          return;
        }
        const r = target.getBoundingClientRect();
        el.style.display = 'block';
        el.style.top = r.top + 'px';
        el.style.left = r.left + 'px';
        el.style.width = r.width + 'px';
        el.style.height = r.height + 'px';
      } catch (e) {}
    }

    function getFiber(node) {
      try {
        const key = Object.keys(node).find(
          (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
        );
        return key ? node[key] : null;
      } catch (e) {
        return null;
      }
    }

    // React 18 + Vite/Babel dev transform은 jsxDEV의 fileName/lineNumber를
    // fiber._debugSource에 직접 보관한다. 이 값이 있으면 source map보다 정확하다.
    function readDebugSource(fiber) {
      try {
        let c = fiber;
        while (c) {
          const source = c._debugSource;
          if (source && source.fileName) {
            return {
              fileName: source.fileName,
              lineNumber: source.lineNumber,
              columnNumber: source.columnNumber,
            };
          }
          c = c.return;
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    // React 19(Turbopack)는 _debugSource를 제거 → _debugStack(번들 위치) + _debugOwner(컴포넌트)
    function readComponentName(fiber) {
      try {
        let c = fiber;
        while (c) {
          const t = (c._debugOwner && c._debugOwner.type) || c.type;
          if (typeof t === 'function' && (t.displayName || t.name)) return t.displayName || t.name;
          c = c.return;
        }
        return undefined;
      } catch (e) {
        return undefined;
      }
    }

    // _debugStack에서 jsxDEV 호출부(요소의 번들 위치) 프레임을 추출
    function readFrame(fiber) {
      try {
        let c = fiber;
        while (c) {
          const stack = c._debugStack && (c._debugStack.stack || '');
          if (stack) {
            const lines = stack.split('\\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].indexOf('jsxDEV') !== -1 || lines[i].indexOf('jsx-dev-runtime') !== -1) {
                const next = lines[i + 1] || '';
                const m =
                  next.match(/\\((https?:\\/\\/[^)]+):(\\d+):(\\d+)\\)/) ||
                  next.match(/(https?:\\/\\/\\S+):(\\d+):(\\d+)/);
                if (m) return { url: m[1], line: Number(m[2]), column: Number(m[3]) };
              }
            }
            // jsxDEV 라벨이 없으면 첫 앱 청크 프레임 사용
            for (let i = 0; i < lines.length; i++) {
              if (
                (lines[i].indexOf('/_next/static/chunks/') !== -1 ||
                  lines[i].indexOf('/src/') !== -1 ||
                  lines[i].indexOf('/@fs/') !== -1) &&
                lines[i].indexOf('react-dom') === -1 &&
                lines[i].indexOf('react-server-dom') === -1 &&
                lines[i].indexOf('/node_modules/') === -1
              ) {
                const m =
                  lines[i].match(/\\((https?:\\/\\/[^)]+):(\\d+):(\\d+)\\)/) ||
                  lines[i].match(/(https?:\\/\\/\\S+):(\\d+):(\\d+)/);
                if (m) return { url: m[1], line: Number(m[2]), column: Number(m[3]) };
              }
            }
          }
          c = c.return;
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    function buildPayload(target) {
      try {
        const fiber = getFiber(target);
        const source = fiber ? readDebugSource(fiber) : null;
        const frame = source ? null : fiber ? readFrame(fiber) : null;
        const componentName = fiber ? readComponentName(fiber) : undefined;
        if (source || frame) return { source, frame, componentName };
        return {
          notFound: true,
          componentName,
          tagName: target && target.tagName ? target.tagName.toLowerCase() : undefined,
          text: target && target.textContent ? target.textContent.trim().slice(0, 80) : undefined,
        };
      } catch (e) {
        return { notFound: true };
      }
    }

    // ── 캡처 토글 (modifier 대신) ─────────────────────────────────────────
    // Mac에서 Ctrl/Cmd/Option/Shift+클릭은 새 탭·창·컨텍스트메뉴 등 브라우저 고유
    // 동작이라 modifier로 "일반 동작 통과"가 불가능. 대신 캡처 자체를 토글한다.
    let captureEnabled = true;
    const PILL_ID = '__jc-inspect-toggle';

    // 앱이 app-router면 React가 <html>/<body>를 관리하므로 hydration 때 주입 노드가
    // 제거될 수 있다. ensurePill은 idempotent하게 매번 상태를 반영하고, interval로
    // 사라지면 다시 생성한다(highlight가 mousemove마다 재생성되는 것과 동일한 전략).
    function ensurePill() {
      try {
        let pill = document.getElementById(PILL_ID);
        if (!pill) {
          pill = document.createElement('button');
          pill.id = PILL_ID;
          pill.type = 'button';
          pill.style.cssText = [
            'position:fixed',
            'bottom:16px',
            'right:16px',
            'z-index:2147483647',
            'padding:8px 12px',
            'border-radius:9999px',
            'border:none',
            'font:600 12px/1 ui-sans-serif,system-ui,sans-serif',
            'color:#fff',
            'cursor:pointer',
            'box-shadow:0 6px 20px -6px rgba(0,0,0,0.5)',
          ].join(';');
          pill.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setEnabled(!captureEnabled);
          });
          (document.body || document.documentElement).appendChild(pill);
        }
        pill.textContent = captureEnabled ? '🔍 요소 선택: 켜짐' : '⏸ 요소 선택: 꺼짐 (Esc)';
        pill.style.background = captureEnabled ? '#059669' : '#6b7280';
        return pill;
      } catch (e) {
        return null;
      }
    }

    function setEnabled(v) {
      captureEnabled = v;
      if (!v) moveHighlight(null);
      ensurePill();
    }

    function isOwnUi(node) {
      try {
        const el = node && node.nodeType === 3 ? node.parentElement : node;
        if (!el || !el.closest) return false;
        return Boolean(
          el.closest(
            '#__jc-inspect-toggle, #__jc-net-toggle, #__jc-net-panel, #__jc-perf-toggle, #__jc-perf-panel, #__jc-react-toggle, #__jc-react-panel',
          ),
        );
      } catch (e) {
        return false;
      }
    }

    function onMove(e) {
      if (isOwnUi(e.target)) return;
      if (!captureEnabled) {
        moveHighlight(null);
        return;
      }
      moveHighlight(e.target);
    }

    function onClick(e) {
      try {
        // 토글 버튼 클릭은 자체 핸들러에 맡김
        if (isOwnUi(e.target)) return;
        // 캡처 꺼짐 → 페이지 정상 동작 (modifier 불필요)
        if (!captureEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        window.${BINDING_NAME}(JSON.stringify(buildPayload(e.target)));
      } catch (err) {}
    }

    function onKeyDown(e) {
      // Esc로 캡처 토글 (modifier 충돌 없음)
      if (e.key === 'Escape') setEnabled(!captureEnabled);
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    ensurePill();
    // hydration 등으로 pill이 제거되면 다시 생성
    setInterval(ensurePill, 1000);
  } catch (e) {}
})();
`;

/**
 * 인스펙트된 창에 주입하는 Network 패널. 서버 CDP가 모은 데이터를 노출 바인딩으로
 * 폴링(__jcNetSync)·조회(__jcNetBody)·초기화(__jcNetClear)한다.
 * pill 위쪽의 🌐 Network 토글 버튼으로 열고, 목록/필터/상세(헤더·페이로드·응답·타이밍)·cURL 복사 제공.
 */
const NETWORK_SCRIPT = `
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
          panel.style.cssText = 'position:fixed;bottom:192px;right:16px;width:560px;max-width:92vw;max-height:60vh;z-index:2147483647;display:none;flex-direction:column;background:#0e1117;color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);font:12px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden';
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

/**
 * 인스펙트된 창에 주입하는 Performance 패널. Core Web Vitals(LCP·INP·CLS·FCP·TTFB)는
 * in-page PerformanceObserver로 측정(실제 top-level 페이지 기준이 정확)하고, 로드 타이밍·
 * 메모리·리소스 요약을 함께 표시. 서버 라운드트립 없이 패널이 직접 수집한다.
 */
const PERF_SCRIPT = `
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

/**
 * 인스펙트된 창에 주입하는 React 렌더 모니터. React DevTools 전역 훅을 가로채
 * (React보다 먼저 설치) 매 커밋의 onCommitFiberRoot에서 PerformedWork 플래그로
 * 렌더된 컴포넌트를 트리 순서로 수집. 리렌더 하이라이트 / 횟수 랭킹 / 커밋별 순서 제공.
 * dev 빌드 전용(production은 fiber 디버그 정보 없음). 서버 라운드트립 없이 in-page 수집.
 */
const REACT_SCRIPT = `
(() => {
  try {
    if (window.__jcReactInstalled) return;
    window.__jcReactInstalled = true;

    var PERFORMED_WORK = 1;
    var BTN_ID = '__jc-react-toggle';
    var PANEL_ID = '__jc-react-panel';
    var HL_ID = '__jc-react-hl';
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
    function ensureUi(){
      try {
        var btn=document.getElementById(BTN_ID);
        if(!btn){
          btn=document.createElement('button'); btn.id=BTN_ID; btn.type='button';
          btn.style.cssText='position:fixed;bottom:148px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:9999px;border:none;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#1f2937;cursor:pointer;box-shadow:0 6px 20px -6px rgba(0,0,0,0.5)';
          btn.textContent='⚛️ React';
          btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); state.open=!state.open; if(state.open){ try{ window.dispatchEvent(new CustomEvent('__jcPanelOpen',{detail:'react'})); }catch(e){} } renderPanel(); });
          (document.body||document.documentElement).appendChild(btn);
        }
        var panel=document.getElementById(PANEL_ID);
        if(!panel){
          panel=document.createElement('div'); panel.id=PANEL_ID;
          panel.style.cssText='position:fixed;bottom:192px;right:16px;width:420px;max-width:92vw;max-height:60vh;z-index:2147483647;display:none;flex-direction:column;background:#0e1117;color:#e5e7eb;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 24px 60px -20px rgba(0,0,0,0.7);font:12px/1.45 ui-sans-serif,system-ui,sans-serif;overflow:hidden';
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
        var btn=document.getElementById(BTN_ID); if(btn) btn.style.background = state.open ? '#059669' : '#1f2937';
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

/**
 * macOS / Windows / Linux 기본 Chrome 실행 경로 후보.
 * JC_CHROME_PATH env로 override 가능.
 */
const CHROME_CANDIDATES = [
  process.env.JC_CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));

@Injectable()
export class InspectorService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(InspectorService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;
  private state: InspectorState = 'idle';
  /** 번들 URL → SourceMapConsumer 캐시 (세션 종료 시 destroy) */
  private readonly sourceMaps = new Map<string, Promise<SourceMapConsumer | null>>();
  /** CDP Network 세션 + 누적 레코드 (requestId → record, 삽입 순서 유지) */
  private cdp: CDPSession | null = null;
  private readonly networkRecords = new Map<string, NetRecord>();

  getState(): InspectorState {
    return this.state;
  }

  async start(appUrl: string): Promise<InspectorStatusEvent> {
    try {
      await this.stop();

      this.setState({ state: 'connecting', appUrl });

      // 동적 import — puppeteer-core 미설치 환경에서 모듈 로드 실패 방지
      const puppeteer = (await import('puppeteer-core')).default;
      const executablePath = this.resolveChromePath();
      if (!executablePath) {
        throw new Error(
          'Chrome 실행 파일을 찾지 못했습니다. JC_CHROME_PATH 환경변수로 경로를 지정해 주세요.',
        );
      }

      this.browser = await puppeteer.launch({
        headless: false,
        executablePath,
        defaultViewport: null,
        args: ['--no-first-run', '--no-default-browser-check'],
      });

      const pages = await this.browser.pages();
      this.page = pages[0] ?? (await this.browser.newPage());

      await this.page.exposeFunction(BINDING_NAME, (payload: string) => {
        void this.handleElementPayload(payload);
      });
      // Network 패널용 바인딩 (인스펙트된 창의 패널이 폴링/조회)
      await this.page.exposeFunction('__jcNetSync', () => this.buildNetSnapshot());
      await this.page.exposeFunction('__jcNetBody', (id: string) => this.getResponseBody(id));
      await this.page.exposeFunction('__jcNetClear', () => {
        this.networkRecords.clear();
        return true;
      });

      await this.setupNetworkCapture(this.page);

      // React 모니터는 React보다 먼저 훅을 잡아야 하므로 가장 먼저 주입
      await this.page.evaluateOnNewDocument(REACT_SCRIPT);
      await this.page.evaluateOnNewDocument(OVERLAY_SCRIPT);
      await this.page.evaluateOnNewDocument(NETWORK_SCRIPT);
      await this.page.evaluateOnNewDocument(PERF_SCRIPT);

      await this.page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      // 이미 로드된 현재 페이지에도 즉시 주입 (goto 이전 상태 대비)
      await this.page.evaluate(REACT_SCRIPT);
      await this.page.evaluate(OVERLAY_SCRIPT);
      await this.page.evaluate(NETWORK_SCRIPT);
      await this.page.evaluate(PERF_SCRIPT);

      // 사용자가 Chrome 창을 직접 닫은 경우 정리
      this.browser.on('disconnected', () => {
        this.browser = null;
        this.page = null;
        this.setState({ state: 'idle' });
      });

      this.setState({ state: 'active', appUrl });
      this.logger.log(`Inspector session started: ${appUrl}`);
      return { state: this.state, appUrl };
    } catch (err) {
      const error = err instanceof Error ? err.message : '인스펙터를 시작하지 못했습니다';
      this.logger.error(`Inspector start failed: ${error}`);
      await this.stop();
      this.setState({ state: 'idle', error });
      return { state: 'idle', error };
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (err) {
      this.logger.warn(
        `Inspector browser close failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.browser = null;
      this.page = null;
      this.cdp = null;
      this.networkRecords.clear();
      await this.clearSourceMaps();
      if (this.state !== 'idle') this.setState({ state: 'idle' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  // ── Network (CDP) ──────────────────────────────────────────────────────
  private async setupNetworkCapture(page: Page): Promise<void> {
    try {
      const client = await page.target().createCDPSession();
      this.cdp = client;
      await client.send('Network.enable');

      client.on('Network.requestWillBeSent', (e) => {
        try {
          const rec: NetRecord = this.networkRecords.get(e.requestId) ?? { id: e.requestId };
          rec.method = e.request.method;
          rec.url = e.request.url;
          rec.name = this.urlName(e.request.url);
          rec.requestHeaders = e.request.headers as Record<string, string>;
          if (e.request.postData) rec.postData = e.request.postData;
          if (e.type) rec.type = e.type;
          if (rec.startTime == null) rec.startTime = e.timestamp;
          if (rec.status == null) rec.status = 0;
          this.networkRecords.set(e.requestId, rec);
          this.capNetworkRecords();
        } catch {}
      });

      client.on('Network.responseReceived', (e) => {
        try {
          const rec: NetRecord = this.networkRecords.get(e.requestId) ?? { id: e.requestId };
          rec.status = e.response.status;
          rec.statusText = e.response.statusText;
          rec.mime = e.response.mimeType;
          rec.responseHeaders = e.response.headers as Record<string, string>;
          if (e.type) rec.type = e.type;
          rec.timing = this.timingPhases(e.response.timing);
          this.networkRecords.set(e.requestId, rec);
        } catch {}
      });

      client.on('Network.loadingFinished', (e) => {
        try {
          const rec = this.networkRecords.get(e.requestId);
          if (!rec) return;
          rec.size = e.encodedDataLength;
          rec.durationMs =
            rec.startTime != null ? (e.timestamp - rec.startTime) * 1000 : undefined;
          rec.done = true;
          if (rec.timing) rec.timing.total = rec.durationMs ?? rec.timing.total;
        } catch {}
      });

      client.on('Network.loadingFailed', (e) => {
        try {
          const rec = this.networkRecords.get(e.requestId);
          if (!rec) return;
          rec.failed = true;
          rec.errorText = e.errorText;
          rec.durationMs =
            rec.startTime != null ? (e.timestamp - rec.startTime) * 1000 : undefined;
          rec.done = true;
        } catch {}
      });
    } catch (err) {
      this.logger.warn(
        `Network capture setup failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** 패널이 폴링하는 스냅샷 (응답 바디는 제외 — 펼칠 때 별도 조회) */
  private buildNetSnapshot(): Omit<NetRecord, never>[] {
    try {
      return Array.from(this.networkRecords.values()).map((r) => ({ ...r }));
    } catch {
      return [];
    }
  }

  private async getResponseBody(id: string): Promise<{ body: string; base64Encoded: boolean } | null> {
    try {
      if (!this.cdp) return null;
      const res = await this.cdp.send('Network.getResponseBody', { requestId: id });
      return { body: res.body, base64Encoded: res.base64Encoded };
    } catch {
      return null;
    }
  }

  private timingPhases(t?: {
    dnsStart: number;
    dnsEnd: number;
    connectStart: number;
    connectEnd: number;
    sslStart: number;
    sslEnd: number;
    sendStart: number;
    sendEnd: number;
    receiveHeadersEnd: number;
  }): NetRecord['timing'] {
    try {
      if (!t) return null;
      const d = (a: number, b: number) => (a >= 0 && b >= 0 && b >= a ? b - a : 0);
      return {
        dns: d(t.dnsStart, t.dnsEnd),
        connect: d(t.connectStart, t.connectEnd),
        ssl: d(t.sslStart, t.sslEnd),
        send: d(t.sendStart, t.sendEnd),
        wait: d(t.sendEnd, t.receiveHeadersEnd),
        total: 0,
      };
    } catch {
      return null;
    }
  }

  private urlName(url?: string): string {
    try {
      if (!url) return '';
      const u = new URL(url);
      const seg = u.pathname.split('/').filter(Boolean).at(-1);
      return seg || u.hostname;
    } catch {
      return url ?? '';
    }
  }

  private capNetworkRecords(): void {
    try {
      while (this.networkRecords.size > MAX_NET_RECORDS) {
        const first = this.networkRecords.keys().next().value;
        if (first === undefined) break;
        this.networkRecords.delete(first);
      }
    } catch {}
  }

  private async handleElementPayload(payload: string): Promise<void> {
    try {
      const data = JSON.parse(payload) as InspectorRawPayload;

      if (data.source?.fileName) {
        const sourceFile = this.toAbsolutePath(data.source.fileName);
        const range = await this.resolveElementRange(
          sourceFile,
          data.source.lineNumber,
          data.source.columnNumber,
        );
        const line = range?.startLine ?? data.source.lineNumber;
        const column = data.source.columnNumber;

        this.emit('inspector:element', {
          fileName: sourceFile,
          line,
          column,
          endLine: range?.endLine,
          componentName: data.componentName,
        } satisfies InspectorElementEvent);
        return;
      }

      if (data.notFound || !data.frame) {
        this.emit('inspector:element', {
          notFound: true,
          componentName: data.componentName,
          tagName: data.tagName,
          text: data.text,
        } satisfies InspectorElementEvent);
        return;
      }

      const resolved = await this.resolveFrame(data.frame);
      if (!resolved) {
        this.emit('inspector:element', {
          notFound: true,
          componentName: data.componentName,
        } satisfies InspectorElementEvent);
        return;
      }

      const range = await this.resolveElementRange(
        resolved.fileName,
        resolved.line,
        resolved.column,
      );
      const line = range?.startLine ?? resolved.line;

      this.emit('inspector:element', {
        fileName: resolved.fileName,
        line,
        column: resolved.column,
        endLine: range?.endLine,
        componentName: data.componentName,
      } satisfies InspectorElementEvent);
    } catch (err) {
      this.logger.warn(
        `Inspector payload handle failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** 번들 frame(url:line:column)을 source map으로 원본 파일/라인에 매핑 */
  private async resolveFrame(frame: {
    url: string;
    line: number;
    column: number;
  }): Promise<{ fileName: string; line?: number; column?: number } | null> {
    try {
      const consumer = await this.getSourceMap(frame.url);
      if (!consumer) return null;

      // source map column은 0-base, V8 stack column은 1-base
      const original = consumer.originalPositionFor({
        line: frame.line,
        column: Math.max(0, frame.column - 1),
      });
      if (!original.source) return null;

      // 1단계 결과가 또 다른 생성 파일(dist/*.cjs 등)이면 그 파일의 source map을
      // 디스크에서 읽어 원본까지 재귀적으로 따라간다.
      return this.chainThroughDiskMaps(
        this.toAbsolutePath(original.source),
        original.line ?? undefined,
        original.column ?? undefined,
      );
    } catch (err) {
      this.logger.warn(
        `Inspector frame resolve failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * 원본 파일을 TS AST로 파싱해 (line, column)을 감싸는 JSX 요소의 시작~끝 줄을 구한다.
   * typescript 미설치/파싱 실패 시 null (호출부에서 시작 줄만 사용).
   */
  private async resolveElementRange(
    fileName: string,
    line: number | undefined,
    column: number | undefined,
  ): Promise<{ startLine: number; endLine: number } | null> {
    try {
      if (!line || !fs.existsSync(fileName)) return null;

      const ts = await import('typescript');
      const content = fs.readFileSync(fileName, 'utf8');
      const sf = ts.createSourceFile(
        fileName,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      // column이 줄 길이를 넘으면 getPositionOfLineAndCharacter가 throw하므로 직접 안전하게 계산
      const lineStarts = sf.getLineStarts();
      const li = line - 1;
      if (li < 0 || li >= lineStarts.length) return null;
      const lineStart = lineStarts[li];
      const lineEnd = li + 1 < lineStarts.length ? lineStarts[li + 1] - 1 : content.length;
      const clampedCol = Math.max(0, Math.min(column ?? 0, Math.max(0, lineEnd - lineStart - 1)));
      const pos = lineStart + clampedCol;

      // pos를 포함하는 가장 깊은 노드 탐색
      let deepest: import('typescript').Node = sf;
      const visit = (node: import('typescript').Node) => {
        if (pos >= node.getStart(sf) && pos < node.getEnd()) {
          deepest = node;
          node.forEachChild(visit);
        }
      };
      sf.forEachChild(visit);

      // 감싸는 JSX 요소까지 상향
      let jsx: import('typescript').Node | undefined = deepest;
      while (jsx) {
        if (ts.isJsxElement(jsx) || ts.isJsxSelfClosingElement(jsx) || ts.isJsxFragment(jsx)) {
          break;
        }
        jsx = jsx.parent;
      }
      if (!jsx) return null;

      const startLine = sf.getLineAndCharacterOfPosition(jsx.getStart(sf)).line + 1;
      const endLine = sf.getLineAndCharacterOfPosition(jsx.getEnd()).line + 1;
      return { startLine, endLine };
    } catch (err) {
      this.logger.warn(
        `Inspector element range resolve failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * absPath가 source map을 가진 생성 파일이면 그 map으로 한 단계 더 내려가며
   * 더 이상 map이 없는 진짜 원본 파일에 도달할 때까지 반복.
   */
  private async chainThroughDiskMaps(
    absPath: string,
    line: number | undefined,
    column: number | undefined,
  ): Promise<{ fileName: string; line?: number; column?: number }> {
    let currentPath = absPath;
    let currentLine = line;
    let currentColumn = column;

    for (let depth = 0; depth < 8; depth++) {
      const found = this.readDiskSourceMap(currentPath);
      if (!found || currentLine == null) break;

      let consumer: SourceMapConsumer | null = null;
      try {
        consumer = await new SourceMapConsumer(found.raw);
        const next = consumer.originalPositionFor({
          line: currentLine,
          column: currentColumn ?? 0,
        });
        if (!next.source) break;

        const nextPath = this.resolveSourcePath(found.baseDir, found.sourceRoot, next.source);
        if (!nextPath || nextPath === currentPath) break;

        currentPath = nextPath;
        currentLine = next.line ?? undefined;
        currentColumn = next.column ?? undefined;
      } catch {
        break;
      } finally {
        consumer?.destroy();
      }
    }

    return { fileName: currentPath, line: currentLine, column: currentColumn };
  }

  /** 디스크 파일의 sourceMappingURL(inline data URI 또는 인접 .map)을 읽어 파싱 */
  private readDiskSourceMap(
    absPath: string,
  ): { raw: RawSourceMap | RawIndexMap; baseDir: string; sourceRoot?: string } | null {
    try {
      if (!absPath || !fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return null;

      const content = fs.readFileSync(absPath, 'utf8');
      const match = content.match(/\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/m);
      if (!match) return null;

      const url = match[1];
      let raw: RawSourceMap | RawIndexMap;
      let baseDir = path.dirname(absPath);

      const dataMatch = url.match(/^data:application\/json[^,]*;base64,(.*)$/);
      if (dataMatch) {
        raw = JSON.parse(Buffer.from(dataMatch[1], 'base64').toString('utf8'));
      } else if (url.startsWith('data:application/json,')) {
        raw = JSON.parse(decodeURIComponent(url.slice('data:application/json,'.length)));
      } else {
        const mapPath = path.resolve(baseDir, decodeURIComponent(url));
        if (!fs.existsSync(mapPath)) return null;
        raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        baseDir = path.dirname(mapPath);
      }

      const sourceRoot = (raw as RawSourceMap).sourceRoot;
      return { raw, baseDir, sourceRoot };
    } catch (err) {
      this.logger.warn(
        `Inspector disk source map read failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** source map의 source 항목을 절대 디스크 경로로 변환 */
  private resolveSourcePath(
    baseDir: string,
    sourceRoot: string | undefined,
    source: string,
  ): string {
    try {
      if (source.startsWith('file://')) return fileURLToPath(source);

      const cleaned = source
        .replace(/^webpack:\/\/_N_E\//, '')
        .replace(/^webpack:\/\//, '')
        .replace(/^\.\//, '');
      if (path.isAbsolute(cleaned)) return cleaned;

      return path.resolve(baseDir, sourceRoot ?? '', cleaned);
    } catch {
      return source;
    }
  }

  private getSourceMap(bundleUrl: string): Promise<SourceMapConsumer | null> {
    const cached = this.sourceMaps.get(bundleUrl);
    if (cached) return cached;

    const loading = (async () => {
      try {
        const res = await fetch(`${bundleUrl}.map`);
        if (!res.ok) return null;
        const raw = (await res.json()) as RawSourceMap | RawIndexMap;
        return await new SourceMapConsumer(raw);
      } catch (err) {
        this.logger.warn(
          `Inspector source map load failed: ${err instanceof Error ? err.message : err}`,
        );
        return null;
      }
    })();

    this.sourceMaps.set(bundleUrl, loading);
    return loading;
  }

  private toAbsolutePath(source: string): string {
    try {
      if (source.startsWith('file://')) return fileURLToPath(source);
      // webpack:// 등 스킴 제거 — 가능한 만큼만 정리
      return source.replace(/^webpack:\/\/_N_E\//, '').replace(/^webpack:\/\//, '');
    } catch {
      return source;
    }
  }

  private async clearSourceMaps(): Promise<void> {
    try {
      for (const promise of this.sourceMaps.values()) {
        const consumer = await promise;
        consumer?.destroy();
      }
    } catch {
    } finally {
      this.sourceMaps.clear();
    }
  }

  private setState(event: InspectorStatusEvent): void {
    this.state = event.state;
    this.emit('inspector:status', event);
  }

  private resolveChromePath(): string | null {
    try {
      for (const candidate of CHROME_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    } catch {
      return null;
    }
  }
}
