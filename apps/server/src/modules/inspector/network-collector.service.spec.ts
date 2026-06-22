import { EventEmitter } from 'events';

import { computeTiming, NetworkCollectorService, urlName } from './network-collector.service';

function rawTiming(over: Partial<Record<string, number>> = {}) {
  return {
    dnsStart: 0,
    dnsEnd: 1,
    connectStart: 1,
    connectEnd: 3,
    sslStart: -1,
    sslEnd: -1,
    sendStart: 3,
    sendEnd: 4,
    receiveHeadersEnd: 50,
    ...over,
  };
}

describe('computeTiming', () => {
  it('구간을 ms로 계산한다', () => {
    expect(computeTiming(rawTiming())).toEqual({
      dns: 1,
      connect: 2,
      ssl: 0,
      send: 1,
      wait: 46,
      total: 0,
    });
  });
  it('음수(미적용) 구간은 0', () => {
    const t = computeTiming(rawTiming({ dnsStart: -1, dnsEnd: -1 }));
    expect(t!.dns).toBe(0);
  });
  it('타이밍 없으면 null', () => {
    expect(computeTiming(undefined)).toBeNull();
  });
});

describe('urlName', () => {
  it('마지막 경로 세그먼트', () => {
    expect(urlName('http://host/api/users.json?x=1')).toBe('users.json');
  });
  it('경로가 없으면 호스트', () => {
    expect(urlName('http://host/')).toBe('host');
  });
  it('잘못된 URL은 입력 반환', () => {
    expect(urlName('not a url')).toBe('not a url');
    expect(urlName(undefined)).toBe('');
  });
});

describe('NetworkCollectorService', () => {
  let service: NetworkCollectorService;
  let client: EventEmitter & { send: jest.Mock };
  let page: { target: () => { createCDPSession: () => Promise<unknown> } };

  beforeEach(async () => {
    service = new NetworkCollectorService();
    client = Object.assign(new EventEmitter(), {
      send: jest.fn((method: string) =>
        method === 'Network.getResponseBody'
          ? Promise.resolve({ body: 'RESP', base64Encoded: false })
          : Promise.resolve({}),
      ),
    });
    page = { target: () => ({ createCDPSession: () => Promise.resolve(client) }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await service.attach(page as any);
  });

  function fullRequest(id: string, over: Record<string, unknown> = {}) {
    client.emit('Network.requestWillBeSent', {
      requestId: id,
      request: { method: 'GET', url: 'http://h/api/' + id, headers: { a: 'b' }, postData: undefined },
      type: 'Fetch',
      timestamp: 100,
      ...over,
    });
  }

  it('enable을 호출하고 요청 라이프사이클을 누적한다', () => {
    expect(client.send).toHaveBeenCalledWith('Network.enable');

    fullRequest('1');
    client.emit('Network.responseReceived', {
      requestId: '1',
      response: { status: 200, statusText: 'OK', mimeType: 'application/json', headers: {}, timing: rawTiming() },
      type: 'Fetch',
    });
    client.emit('Network.loadingFinished', { requestId: '1', timestamp: 100.2, encodedDataLength: 1234 });

    const snap = service.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toMatchObject({
      id: '1',
      method: 'GET',
      name: '1',
      type: 'Fetch',
      status: 200,
      mime: 'application/json',
      size: 1234,
      done: true,
    });
    expect(snap[0].durationMs).toBeCloseTo(200, 1);
    expect(snap[0].timing!.total).toBeCloseTo(200, 1);
  });

  it('loadingFailed를 실패로 기록한다', () => {
    fullRequest('e1');
    client.emit('Network.loadingFailed', { requestId: 'e1', timestamp: 100.1, errorText: 'net::ERR' });
    const rec = service.snapshot().find((r) => r.id === 'e1');
    expect(rec).toMatchObject({ failed: true, errorText: 'net::ERR', done: true });
  });

  it('최대 레코드 수를 초과하면 오래된 것부터 버린다', () => {
    for (let i = 0; i < 600; i++) fullRequest('r' + i);
    const snap = service.snapshot();
    expect(snap.length).toBe(500);
    // 가장 오래된 r0..r99는 제거되어야 함
    expect(snap.find((r) => r.id === 'r0')).toBeUndefined();
    expect(snap.find((r) => r.id === 'r599')).toBeDefined();
  });

  it('getBody는 CDP getResponseBody 결과를 반환한다', async () => {
    fullRequest('1');
    const body = await service.getBody('1');
    expect(body).toEqual({ body: 'RESP', base64Encoded: false });
    expect(client.send).toHaveBeenCalledWith('Network.getResponseBody', { requestId: '1' });
  });

  it('clear/detach는 레코드를 비운다', () => {
    fullRequest('1');
    expect(service.snapshot()).toHaveLength(1);
    service.clear();
    expect(service.snapshot()).toHaveLength(0);
  });
});
