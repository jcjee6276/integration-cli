/* eslint-disable */
/**
 * 요소 인스펙트 overlay: hover outline + 클릭 캡처 → fiber에서 소스 위치 추출,
 * 우하단 토글 pill / Esc 로 캡처 ON·OFF.
 *
 * 주의: 인스펙트된 브라우저(페이지) 컨텍스트에서 실행되는 vanilla JS 문자열이다.
 * 서버 빌드 타깃과 무관하므로 lint/타입체크 대상에서 제외한다.
 */
import { BINDING_NAME } from './constants';

export const OVERLAY_SCRIPT = `
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
            '#__jc-inspect-toggle, #__jc-inspect-toolbox, #__jc-net-toggle, #__jc-net-panel, #__jc-perf-toggle, #__jc-perf-panel, #__jc-react-toggle, #__jc-react-panel, #__jc-console-toggle, #__jc-console-panel',
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
