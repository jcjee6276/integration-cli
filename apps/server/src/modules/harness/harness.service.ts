import * as fs from 'fs';
import * as path from 'path';

import { Injectable } from '@nestjs/common';

import { JI_PATHS } from '../../common/ji-paths';

export type HarnessRole = 'common' | 'frontend' | 'backend' | 'doc' | 'operation' | 'other';
export type HarnessExt = 'md' | 'tsx';

export interface Harness {
  role: HarnessRole;
  ext: HarnessExt;
  content: string;
}

const ALL_ROLES: HarnessRole[] = ['common', 'frontend', 'backend', 'doc', 'operation', 'other'];

@Injectable()
export class HarnessService {

  findAll(): Harness[] {
    return ALL_ROLES.map((role) => this.findOne(role)).filter(Boolean) as Harness[];
  }

  findOne(role: HarnessRole): Harness | null {
    for (const ext of ['md', 'tsx'] as HarnessExt[]) {
      const filePath = path.join(JI_PATHS.harness, `${role}.${ext}`);
      if (fs.existsSync(filePath)) {
        return { role, ext, content: fs.readFileSync(filePath, 'utf8') };
      }
    }
    return null;
  }

  save(role: HarnessRole, content: string, ext: HarnessExt): Harness {
    const targetPath = path.join(JI_PATHS.harness, `${role}.${ext}`);
    const otherExt: HarnessExt = ext === 'md' ? 'tsx' : 'md';
    const otherPath = path.join(JI_PATHS.harness, `${role}.${otherExt}`);

    // 다른 확장자 파일 존재 시 제거 (확장자 변경 처리)
    if (fs.existsSync(otherPath)) fs.unlinkSync(otherPath);

    fs.writeFileSync(targetPath, content, 'utf8');
    return { role, ext, content };
  }

  remove(role: HarnessRole): void {
    for (const ext of ['md', 'tsx'] as HarnessExt[]) {
      const filePath = path.join(JI_PATHS.harness, `${role}.${ext}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
}
