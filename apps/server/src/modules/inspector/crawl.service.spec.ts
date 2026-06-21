import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CrawlService } from './crawl.service';
import type { SourceResolverService } from './source-resolver.service';

function touch(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'export default function Page(){return null;}');
}

describe('CrawlService.discoverRoutes', () => {
  let service: CrawlService;
  let tmp: string;

  beforeEach(() => {
    service = new CrawlService({} as unknown as SourceResolverService);
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-crawl-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  });

  it('app 디렉토리에서 정적 라우트를 추출하고 동적/그룹을 처리한다', () => {
    touch(path.join(tmp, 'app', 'page.tsx'));
    touch(path.join(tmp, 'app', 'projects', 'page.tsx'));
    touch(path.join(tmp, 'app', '(marketing)', 'about', 'page.tsx')); // route group → /about
    touch(path.join(tmp, 'app', 'blog', '[slug]', 'page.tsx')); // 동적 → 제외
    touch(path.join(tmp, 'app', 'dashboard', 'settings', 'page.tsx'));

    expect(service.discoverRoutes(tmp)).toEqual(['/', '/about', '/dashboard/settings', '/projects']);
  });

  it('src/app 도 인식한다', () => {
    touch(path.join(tmp, 'src', 'app', 'page.tsx'));
    touch(path.join(tmp, 'src', 'app', 'login', 'page.tsx'));
    expect(service.discoverRoutes(tmp)).toEqual(['/', '/login']);
  });

  it('app 디렉토리가 없으면 / 만 반환', () => {
    expect(service.discoverRoutes(tmp)).toEqual(['/']);
  });

  it('node_modules 등은 탐색하지 않는다', () => {
    touch(path.join(tmp, 'app', 'page.tsx'));
    touch(path.join(tmp, 'app', 'node_modules', 'pkg', 'page.tsx'));
    expect(service.discoverRoutes(tmp)).toEqual(['/']);
  });
});
