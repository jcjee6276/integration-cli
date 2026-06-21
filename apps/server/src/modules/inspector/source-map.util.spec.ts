import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SourceMapGenerator } from 'source-map';

import {
  chainThroughDiskMaps,
  readDiskSourceMap,
  resolveElementRange,
  resolveSourcePath,
  toAbsolutePath,
} from './source-map.util';

describe('source-map.util', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-srcmap-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  describe('toAbsolutePath', () => {
    it('file:// URL을 디스크 경로로 변환한다', () => {
      expect(toAbsolutePath('file:///Users/a/b.tsx')).toBe('/Users/a/b.tsx');
    });
    it('webpack 스킴을 정리한다', () => {
      expect(toAbsolutePath('webpack://_N_E/./src/x.ts')).toBe('./src/x.ts');
      expect(toAbsolutePath('webpack://./src/y.ts')).toBe('./src/y.ts');
    });
    it('평범한 경로는 그대로 둔다', () => {
      expect(toAbsolutePath('/abs/path.ts')).toBe('/abs/path.ts');
    });
  });

  describe('resolveSourcePath', () => {
    it('상대 source를 baseDir 기준 절대경로로 만든다', () => {
      expect(resolveSourcePath('/proj/dist', undefined, '../src/a.ts')).toBe('/proj/src/a.ts');
    });
    it('sourceRoot를 반영한다', () => {
      expect(resolveSourcePath('/proj/dist', 'nested', './a.ts')).toBe('/proj/dist/nested/a.ts');
    });
    it('file:// 와 절대경로는 그대로', () => {
      expect(resolveSourcePath('/x', undefined, 'file:///abs/a.ts')).toBe('/abs/a.ts');
      expect(resolveSourcePath('/x', undefined, '/already/abs.ts')).toBe('/already/abs.ts');
    });
  });

  describe('readDiskSourceMap', () => {
    it('인접 .map 파일을 읽는다', () => {
      const js = path.join(tmp, 'a.js');
      fs.writeFileSync(js, 'var x=1;\n//# sourceMappingURL=a.js.map');
      fs.writeFileSync(path.join(tmp, 'a.js.map'), JSON.stringify({ version: 3, sources: ['a.ts'], mappings: '' }));
      const found = readDiskSourceMap(js);
      expect(found).not.toBeNull();
      expect((found!.raw as { sources: string[] }).sources).toEqual(['a.ts']);
      expect(found!.baseDir).toBe(tmp);
    });

    it('inline base64 data URI를 읽는다', () => {
      const map = { version: 3, sources: ['b.ts'], mappings: '' };
      const b64 = Buffer.from(JSON.stringify(map)).toString('base64');
      const js = path.join(tmp, 'b.js');
      fs.writeFileSync(js, 'var y=2;\n//# sourceMappingURL=data:application/json;base64,' + b64);
      const found = readDiskSourceMap(js);
      expect((found!.raw as { sources: string[] }).sources).toEqual(['b.ts']);
    });

    it('sourceMappingURL이 없으면 null', () => {
      const js = path.join(tmp, 'plain.js');
      fs.writeFileSync(js, 'var z=3;');
      expect(readDiskSourceMap(js)).toBeNull();
    });

    it('존재하지 않는 파일은 null', () => {
      expect(readDiskSourceMap(path.join(tmp, 'nope.js'))).toBeNull();
    });
  });

  describe('chainThroughDiskMaps', () => {
    it('생성 파일 → 원본까지 source map을 따라간다', async () => {
      // gen.js (2줄) → orig.ts:5 로 매핑되는 맵 생성
      const g = new SourceMapGenerator({ file: 'gen.js' });
      g.addMapping({ generated: { line: 2, column: 0 }, original: { line: 5, column: 0 }, source: 'orig.ts' });
      fs.writeFileSync(path.join(tmp, 'gen.js'), 'line1\nline2\n//# sourceMappingURL=gen.js.map');
      fs.writeFileSync(path.join(tmp, 'gen.js.map'), g.toString());
      fs.writeFileSync(path.join(tmp, 'orig.ts'), 'a\nb\nc\nd\ne\n'); // 더 이상 map 없음 → 여기서 멈춤

      const res = await chainThroughDiskMaps(path.join(tmp, 'gen.js'), 2, 0);
      expect(res.fileName).toBe(path.join(tmp, 'orig.ts'));
      expect(res.line).toBe(5);
    });

    it('map이 없으면 입력 위치를 그대로 반환', async () => {
      const res = await chainThroughDiskMaps(path.join(tmp, 'orig.ts'), 5, 0);
      expect(res.fileName).toBe(path.join(tmp, 'orig.ts'));
      expect(res.line).toBe(5);
    });
  });

  describe('resolveElementRange', () => {
    const tsx = [
      'export function Demo() {',
      '  return (',
      '    <div className="box">',
      '      <span>hello</span>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');

    it('JSX 요소를 감싸는 시작~끝 줄을 구한다', async () => {
      const file = path.join(tmp, 'Demo.tsx');
      fs.writeFileSync(file, tsx);
      const range = await resolveElementRange(file, 3, 4); // <div> 위치
      expect(range).toEqual({ startLine: 3, endLine: 5 });
    });

    it('내부 self-closing/요소도 자체 범위를 구한다', async () => {
      const file = path.join(tmp, 'Demo.tsx');
      const range = await resolveElementRange(file, 4, 6); // <span>hello</span>
      expect(range).toEqual({ startLine: 4, endLine: 4 });
    });

    it('존재하지 않는 파일/라인 없음이면 null', async () => {
      expect(await resolveElementRange(path.join(tmp, 'no.tsx'), 1, 0)).toBeNull();
      expect(await resolveElementRange(path.join(tmp, 'Demo.tsx'), undefined, 0)).toBeNull();
    });
  });
});
