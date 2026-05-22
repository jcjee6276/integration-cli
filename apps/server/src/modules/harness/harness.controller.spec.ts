import { Test, TestingModule } from '@nestjs/testing';

import { HarnessController } from './harness.controller';
import { HarnessService } from './harness.service';
import type { Harness } from './harness.service';

describe('HarnessController', () => {
  let controller: HarnessController;
  let service: jest.Mocked<HarnessService>;

  const commonHarness: Harness = { role: 'common', ext: 'md', content: '# Common Template' };
  const frontendHarness: Harness = { role: 'frontend', ext: 'tsx', content: 'export default () => null;' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HarnessController],
      providers: [
        {
          provide: HarnessService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(HarnessController);
    service = module.get(HarnessService) as jest.Mocked<HarnessService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('service.findAll을 호출하고 모든 harness를 반환한다', () => {
      service.findAll.mockReturnValue([commonHarness, frontendHarness]);

      const result = controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([commonHarness, frontendHarness]);
    });
  });

  describe('findOne', () => {
    it('harness가 존재하면 반환한다', () => {
      service.findOne.mockReturnValue(commonHarness);

      const result = controller.findOne('common');

      expect(service.findOne).toHaveBeenCalledWith('common');
      expect(result).toBe(commonHarness);
    });

    it('harness가 없으면 기본값을 반환한다', () => {
      service.findOne.mockReturnValue(null);

      const result = controller.findOne('other');

      expect(result).toEqual({ role: 'other', ext: 'md', content: '' });
    });
  });

  describe('save', () => {
    it('service.save를 role, content, ext와 함께 호출한다', () => {
      service.save.mockReturnValue(commonHarness);

      const result = controller.save('common', { content: '# Common Template', ext: 'md' });

      expect(service.save).toHaveBeenCalledWith('common', '# Common Template', 'md');
      expect(result).toBe(commonHarness);
    });

    it('tsx 확장자로 저장할 수 있다', () => {
      service.save.mockReturnValue(frontendHarness);

      const result = controller.save('frontend', { content: 'export default () => null;', ext: 'tsx' });

      expect(service.save).toHaveBeenCalledWith('frontend', 'export default () => null;', 'tsx');
      expect(result).toBe(frontendHarness);
    });
  });

  describe('remove', () => {
    it('service.remove를 role과 함께 호출한다', () => {
      service.remove.mockReturnValue(undefined);

      controller.remove('common');

      expect(service.remove).toHaveBeenCalledWith('common');
    });
  });
});
