import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SourceMapGenerator } from 'source-map';

import { SourceResolverService } from './source-resolver.service';

const TSX = [
  'export function Demo() {',
  '  return (',
  '    <div className="box">',
  '      <span>hello</span>',
  '    </div>',
  '  );',
  '}',
  '',
].join('\n');

describe('SourceResolverService', () => {
  let service: SourceResolverService;
  let tmp: string;
  let tsxPath: string;
  const realFetch = global.fetch;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-resolver-'));
    tsxPath = path.join(tmp, 'Demo.tsx');
    fs.writeFileSync(tsxPath, TSX);
  });

  afterAll(() => {
    global.fetch = realFetch;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    service = new SourceResolverService();
  });

  describe('resolveDebugSource', () => {
    it('절대경로 + 위치 → 요소 범위(endLine)까지 매핑', async () => {
      const res = await service.resolveDebugSource({ fileName: tsxPath, lineNumber: 3, columnNumber: 4 });
      expect(res).toEqual({ fileName: tsxPath, line: 3, column: 4, endLine: 5 });
    });

    it('file:// 스킴을 정리한다', async () => {
      const res = await service.resolveDebugSource({ fileName: 'file://' + tsxPath, lineNumber: 4, columnNumber: 6 });
      expect(res.fileName).toBe(tsxPath);
      expect(res.endLine).toBe(4);
    });
  });

  describe('resolveFrame', () => {
    it('번들 frame → source map(fetch) → 원본 파일/요소 범위', async () => {
      const g = new SourceMapGenerator({ file: 'bundle.js' });
      // 번들 (line10,col5) → 원본 tsx (line3,col4)
      g.addMapping({
        generated: { line: 10, column: 5 },
        original: { line: 3, column: 4 },
        source: 'file://' + tsxPath,
      });
      const mapObj = JSON.parse(g.toString());
      global.fetch = jest.fn(async (url: string) => {
        expect(url).toBe('http://localhost:3000/bundle.js.map');
        return { ok: true, json: async () => mapObj } as Response;
      }) as unknown as typeof fetch;

      const res = await service.resolveFrame({ url: 'http://localhost:3000/bundle.js', line: 10, column: 6 });
      expect(res).toEqual({ fileName: tsxPath, line: 3, column: 4, endLine: 5 });
    });

    it('map fetch 실패 시 null', async () => {
      global.fetch = jest.fn(async () => ({ ok: false }) as Response) as unknown as typeof fetch;
      const res = await service.resolveFrame({ url: 'http://x/none.js', line: 1, column: 1 });
      expect(res).toBeNull();
    });
  });

  describe('resolvePayload', () => {
    it('source가 있으면 resolveDebugSource로 위임', async () => {
      const spy = jest.spyOn(service, 'resolveDebugSource').mockResolvedValue({ fileName: '/x' });
      await service.resolvePayload({ source: { fileName: '/x', lineNumber: 1 } });
      expect(spy).toHaveBeenCalled();
    });
    it('frame만 있으면 resolveFrame으로 위임', async () => {
      const spy = jest.spyOn(service, 'resolveFrame').mockResolvedValue(null);
      await service.resolvePayload({ frame: { url: 'u', line: 1, column: 1 } });
      expect(spy).toHaveBeenCalled();
    });
    it('둘 다 없으면 null', async () => {
      expect(await service.resolvePayload({ notFound: true })).toBeNull();
    });
  });

  it('clear()는 예외 없이 캐시를 비운다', async () => {
    await expect(service.clear()).resolves.toBeUndefined();
  });
});
