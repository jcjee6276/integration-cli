import { InspectorService } from './inspector.service';
import type { InspectorElementEvent } from './inspector.types';
import type { NetworkCollectorService } from './network-collector.service';
import type { SourceResolverService } from './source-resolver.service';

describe('InspectorService', () => {
  let service: InspectorService;
  let sourceResolver: { resolvePayload: jest.Mock; clear: jest.Mock };
  let network: { detach: jest.Mock; clear: jest.Mock; snapshot: jest.Mock };

  beforeEach(() => {
    sourceResolver = { resolvePayload: jest.fn(), clear: jest.fn().mockResolvedValue(undefined) };
    network = { detach: jest.fn(), clear: jest.fn(), snapshot: jest.fn() };
    service = new InspectorService(
      sourceResolver as unknown as SourceResolverService,
      network as unknown as NetworkCollectorService,
    );
  });

  function emitOnce(): Promise<InspectorElementEvent> {
    return new Promise((resolve) => service.once('inspector:element', resolve));
  }

  it('초기 상태는 idle', () => {
    expect(service.getState()).toBe('idle');
  });

  describe('handleElementPayload', () => {
    it('resolve 성공 시 컴포넌트명과 함께 emit', async () => {
      sourceResolver.resolvePayload.mockResolvedValue({ fileName: '/x.tsx', line: 3, endLine: 5 });
      const evt = emitOnce();
      await (service as unknown as { handleElementPayload: (p: string) => Promise<void> }).handleElementPayload(
        JSON.stringify({ frame: { url: 'u', line: 1, column: 1 }, componentName: 'Foo' }),
      );
      await expect(evt).resolves.toEqual({
        fileName: '/x.tsx',
        line: 3,
        endLine: 5,
        componentName: 'Foo',
      });
    });

    it('resolve 실패(null) 시 notFound emit', async () => {
      sourceResolver.resolvePayload.mockResolvedValue(null);
      const evt = emitOnce();
      await (service as unknown as { handleElementPayload: (p: string) => Promise<void> }).handleElementPayload(
        JSON.stringify({ frame: { url: 'u', line: 1, column: 1 }, componentName: 'Bar' }),
      );
      await expect(evt).resolves.toEqual({
        notFound: true,
        componentName: 'Bar',
        tagName: undefined,
        text: undefined,
      });
    });

    it('source/frame 없으면 resolve 호출 없이 notFound', async () => {
      const evt = emitOnce();
      await (service as unknown as { handleElementPayload: (p: string) => Promise<void> }).handleElementPayload(
        JSON.stringify({ notFound: true, tagName: 'button', text: '저장' }),
      );
      await expect(evt).resolves.toEqual({
        notFound: true,
        componentName: undefined,
        tagName: 'button',
        text: '저장',
      });
      expect(sourceResolver.resolvePayload).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('네트워크 detach + 소스맵 clear 후 idle 유지', async () => {
      await service.stop();
      expect(network.detach).toHaveBeenCalled();
      expect(sourceResolver.clear).toHaveBeenCalled();
      expect(service.getState()).toBe('idle');
    });
  });
});
