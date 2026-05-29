import * as fs from 'fs';
import * as path from 'path';

import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';

import { JI_PATHS } from '../../common/ji-paths';

export const HARNESS_ROLES = ['common', 'frontend', 'backend', 'doc', 'operation', 'other'] as const;
const HARNESS_EXTENSIONS = ['md', 'tsx'] as const;

export type HarnessRole = (typeof HARNESS_ROLES)[number];
export type HarnessExt = (typeof HARNESS_EXTENSIONS)[number];

export interface Harness {
  role: HarnessRole;
  ext: HarnessExt;
  content: string;
}

const ALL_ROLES: HarnessRole[] = [...HARNESS_ROLES];
const HARNESS_ROOT = path.resolve(JI_PATHS.harness);

@Injectable()
export class HarnessService {

  findAll(): Harness[] {
    try {
      return ALL_ROLES.map((role) => this.findOne(role)).filter(Boolean) as Harness[];
    } catch (err) {
      this.rethrowHarnessError(err);
    }
  }

  findOne(role: string): Harness | null {
    try {
      const harnessRole = this.parseRole(role);

      for (const ext of HARNESS_EXTENSIONS) {
        const filePath = this.resolveHarnessPath(harnessRole, ext);
        if (fs.existsSync(filePath)) {
          return { role: harnessRole, ext, content: fs.readFileSync(filePath, 'utf8') };
        }
      }
      return null;
    } catch (err) {
      this.rethrowHarnessError(err);
    }
  }

  save(role: string, content: string, ext: HarnessExt): Harness {
    try {
      const harnessRole = this.parseRole(role);
      const harnessExt = this.parseExt(ext);
      const targetPath = this.resolveHarnessPath(harnessRole, harnessExt);
      const otherExt: HarnessExt = harnessExt === 'md' ? 'tsx' : 'md';
      const otherPath = this.resolveHarnessPath(harnessRole, otherExt);

      // 다른 확장자 파일 존재 시 제거 (확장자 변경 처리)
      if (fs.existsSync(otherPath)) fs.unlinkSync(otherPath);

      fs.writeFileSync(targetPath, content, 'utf8');
      return { role: harnessRole, ext: harnessExt, content };
    } catch (err) {
      this.rethrowHarnessError(err);
    }
  }

  remove(role: string): void {
    try {
      const harnessRole = this.parseRole(role);

      for (const ext of HARNESS_EXTENSIONS) {
        const filePath = this.resolveHarnessPath(harnessRole, ext);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.rethrowHarnessError(err);
    }
  }

  private parseRole(role: string): HarnessRole {
    if (!HARNESS_ROLES.includes(role as HarnessRole)) {
      throw new BadRequestException(`지원하지 않는 harness role입니다: ${role}`);
    }
    return role as HarnessRole;
  }

  private parseExt(ext: string): HarnessExt {
    if (!HARNESS_EXTENSIONS.includes(ext as HarnessExt)) {
      throw new BadRequestException(`지원하지 않는 harness 확장자입니다: ${ext}`);
    }
    return ext as HarnessExt;
  }

  private resolveHarnessPath(role: HarnessRole, ext: HarnessExt): string {
    const targetPath = path.resolve(HARNESS_ROOT, `${role}.${ext}`);

    if (path.dirname(targetPath) !== HARNESS_ROOT) {
      throw new BadRequestException(`유효하지 않은 harness 경로입니다: ${role}`);
    }

    return targetPath;
  }

  private rethrowHarnessError(err: unknown): never {
    if (err instanceof BadRequestException) {
      throw err;
    }

    throw new InternalServerErrorException('하네스 파일 처리 중 오류가 발생했습니다.');
  }
}
