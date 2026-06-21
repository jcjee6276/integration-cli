/* eslint-disable */
/**
 * 크롤(헤드리스)용 슬림 React 렌더 카운터. 패널 없이 DevTools 전역 훅만 가로채
 * 커밋마다 렌더된 컴포넌트를 window.__jcRenderCounts[name] = { count, frame } 로 누적.
 * window.__jcResetRenderCounts()로 초기화(마운트 churn 제거 후 idle 측정용).
 *
 * 주의: 인스펙트된 브라우저(페이지) 컨텍스트에서 실행되는 vanilla JS 문자열이다.
 */
export const REACT_COUNT_SCRIPT = `
(() => {
  try {
    if (window.__jcRenderCountInstalled) return;
    window.__jcRenderCountInstalled = true;

    var PERFORMED_WORK = 1;
    window.__jcRenderCounts = {};
    window.__jcResetRenderCounts = function(){ window.__jcRenderCounts = {}; };

    function compName(fiber){
      try {
        var t = (fiber._debugOwner && fiber._debugOwner.type) || fiber.type; if(t==null) return null;
        if(typeof t==='function') return t.displayName || t.name || null;
        if(typeof t==='object'){ if(t.displayName) return t.displayName; if(t.render) return t.render.displayName || t.render.name; if(t.type) return (t.type.displayName || t.type.name); }
        return null;
      } catch(e){ return null; }
    }
    function readFrame(fiber){
      try {
        var stack = fiber._debugStack && (fiber._debugStack.stack || '');
        if(!stack) return null;
        var lines = stack.split('\\n');
        for(var i=0;i<lines.length;i++){
          if(lines[i].indexOf('jsxDEV')!==-1 || lines[i].indexOf('jsx-dev-runtime')!==-1){
            var m=(lines[i+1]||'').match(/\\((https?:\\/\\/[^)]+):(\\d+):(\\d+)\\)/); if(m) return { url:m[1], line:Number(m[2]), column:Number(m[3]) };
          }
        }
        for(var j=0;j<lines.length;j++){
          if(lines[j].indexOf('/_next/static/chunks/')!==-1 && lines[j].indexOf('react-dom')===-1 && lines[j].indexOf('react-server-dom')===-1){
            var m2=lines[j].match(/\\((https?:\\/\\/[^)]+):(\\d+):(\\d+)\\)/); if(m2) return { url:m2[1], line:Number(m2[2]), column:Number(m2[3]) };
          }
        }
        return null;
      } catch(e){ return null; }
    }
    function traverse(root, visit){
      var node=root;
      while(node){
        visit(node);
        if(node.child){ node=node.child; continue; }
        if(node===root) return;
        while(!node.sibling){ if(!node.return || node.return===root) return; node=node.return; }
        node=node.sibling;
      }
    }
    function collect(root){
      try {
        if(!root || !root.current) return;
        traverse(root.current, function(fiber){
          if(((fiber.flags||0) & PERFORMED_WORK) !== PERFORMED_WORK) return;
          var name = compName(fiber); if(!name) return;
          var e = window.__jcRenderCounts[name] || { count:0 };
          e.count++;
          if(!e.frame){ var f = readFrame(fiber); if(f) e.frame = f; }
          window.__jcRenderCounts[name] = e;
        });
      } catch(e){}
    }

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
  } catch (e) {}
})();
`;
