import * as fs from 'fs';

import { resolveChromePath } from './chrome.util';

jest.mock('fs');

describe('resolveChromePath', () => {
  beforeEach(() => jest.clearAllMocks());

  it('후보 중 처음으로 존재하는 경로를 반환한다', () => {
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === '/b');
    expect(resolveChromePath(['/a', '/b', '/c'])).toBe('/b');
  });

  it('아무것도 없으면 null', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    expect(resolveChromePath(['/a', '/b'])).toBeNull();
  });

  it('existsSync가 throw해도 null', () => {
    (fs.existsSync as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });
    expect(resolveChromePath(['/a'])).toBeNull();
  });
});
