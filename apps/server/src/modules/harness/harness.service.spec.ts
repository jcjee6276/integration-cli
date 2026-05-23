import * as fs from 'fs';
import * as path from 'path';

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { JI_PATHS } from '../../common/ji-paths';
import { HarnessService } from './harness.service';

jest.mock('fs');

describe('HarnessService', () => {
  let service: HarnessService;

  const harnessDir = JI_PATHS.harness;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HarnessService],
    }).compile();

    service = module.get(HarnessService);
    jest.clearAllMocks();
  });

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('존재하는 harness 파일들을 모두 반환한다', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) =>
        p === path.join(harnessDir, 'common.md') || p === path.join(harnessDir, 'frontend.tsx'),
      );
      (fs.readFileSync as jest.Mock).mockReturnValue('# content');

      const result = service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: 'common', ext: 'md', content: '# content' });
      expect(result[1]).toEqual({ role: 'frontend', ext: 'tsx', content: '# content' });
    });

    it('파일이 없으면 빈 배열을 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.findAll();

      expect(result).toEqual([]);
    });

    it('md와 tsx 중 먼저 찾은 파일을 반환한다', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) =>
        p === path.join(harnessDir, 'backend.md'),
      );
      (fs.readFileSync as jest.Mock).mockReturnValue('backend content');

      const result = service.findAll();

      const backendEntry = result.find((h) => h.role === 'backend');
      expect(backendEntry?.ext).toBe('md');
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('md 파일이 있으면 반환한다', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) =>
        p === path.join(harnessDir, 'common.md'),
      );
      (fs.readFileSync as jest.Mock).mockReturnValue('# common template');

      const result = service.findOne('common');

      expect(result).toEqual({ role: 'common', ext: 'md', content: '# common template' });
    });

    it('tsx 파일을 md보다 우선하지 않는다 (md 먼저 확인)', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) =>
        p === path.join(harnessDir, 'frontend.tsx'),
      );
      (fs.readFileSync as jest.Mock).mockReturnValue('export default () => <div/>;');

      const result = service.findOne('frontend');

      expect(result).toEqual({ role: 'frontend', ext: 'tsx', content: 'export default () => <div/>;' });
    });

    it('파일이 없으면 null을 반환한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.findOne('backend');

      expect(result).toBeNull();
    });

    it('readFileSync를 utf8로 호출한다', () => {
      const mdPath = path.join(harnessDir, 'doc.md');
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === mdPath);
      (fs.readFileSync as jest.Mock).mockReturnValue('content');

      service.findOne('doc');

      expect(fs.readFileSync).toHaveBeenCalledWith(mdPath, 'utf8');
    });

    it('허용되지 않는 role이면 파일 시스템 접근 전에 거부한다', () => {
      expect(() => service.findOne('../common')).toThrow(BadRequestException);
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });

  // ─── save ─────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('md 파일을 저장한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.save('common', '# new content', 'md');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(harnessDir, 'common.md'),
        '# new content',
        'utf8',
      );
      expect(result).toEqual({ role: 'common', ext: 'md', content: '# new content' });
    });

    it('tsx 파일을 저장한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.save('frontend', 'const X = () => null;', 'tsx');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(harnessDir, 'frontend.tsx'),
        'const X = () => null;',
        'utf8',
      );
      expect(result).toEqual({ role: 'frontend', ext: 'tsx', content: 'const X = () => null;' });
    });

    it('확장자 변경 시 기존 파일을 삭제한다', () => {
      const oldPath = path.join(harnessDir, 'common.tsx');
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === oldPath);

      service.save('common', 'content', 'md');

      expect(fs.unlinkSync).toHaveBeenCalledWith(oldPath);
    });

    it('다른 확장자 파일이 없으면 삭제하지 않는다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      service.save('operation', 'content', 'md');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('허용되지 않는 role이면 파일 쓰기를 수행하지 않는다', () => {
      expect(() => service.save('../common', 'content', 'md')).toThrow(BadRequestException);
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('허용되지 않는 확장자이면 파일 쓰기를 수행하지 않는다', () => {
      expect(() => service.save('common', 'content', 'json' as never)).toThrow(BadRequestException);
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('md 파일을 삭제한다', () => {
      const mdPath = path.join(harnessDir, 'common.md');
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === mdPath);

      service.remove('common');

      expect(fs.unlinkSync).toHaveBeenCalledWith(mdPath);
    });

    it('tsx 파일을 삭제한다', () => {
      const tsxPath = path.join(harnessDir, 'frontend.tsx');
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === tsxPath);

      service.remove('frontend');

      expect(fs.unlinkSync).toHaveBeenCalledWith(tsxPath);
    });

    it('두 확장자 모두 존재하면 둘 다 삭제한다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      service.remove('backend');

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    });

    it('파일이 없으면 삭제하지 않는다', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      service.remove('other');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('허용되지 않는 role이면 파일 삭제를 수행하지 않는다', () => {
      expect(() => service.remove('../common')).toThrow(BadRequestException);
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
