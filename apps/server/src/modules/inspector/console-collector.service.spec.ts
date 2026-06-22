import { EventEmitter } from 'events';

import {
  buildArgText,
  consoleLevel,
  ConsoleCollectorService,
  pickTopFrame,
} from './console-collector.service';

describe('consoleLevel', () => {
  it('CDP type을 레벨로 매핑한다', () => {
    expect(consoleLevel('error')).toBe('error');
    expect(consoleLevel('warning')).toBe('warning');
    expect(consoleLevel('info')).toBe('info');
    expect(consoleLevel('debug')).toBe('debug');
    expect(consoleLevel('verbose')).toBe('debug');
    expect(consoleLevel('log')).toBe('log');
    expect(consoleLevel('table')).toBe('log');
  });
});

describe('buildArgText', () => {
  it('문자열/숫자/객체 인자를 한 줄로 합친다', () => {
    expect(
      buildArgText([
        { type: 'string', value: 'hello' },
        { type: 'number', value: 42 },
        { type: 'object', description: 'Object' },
      ]),
    ).toBe('hello 42 Object');
  });
  it('빈 인자', () => {
    expect(buildArgText([])).toBe('');
  });
});

describe('pickTopFrame', () => {
  it('첫 http(s) 프레임을 1-base로 변환한다', () => {
    const frame = pickTopFrame([
      { functionName: 'x', url: '', lineNumber: 0, columnNumber: 0 },
      { functionName: 'y', url: 'http://h/bundle.js', lineNumber: 9, columnNumber: 4 },
    ]);
    expect(frame).toEqual({ url: 'http://h/bundle.js', line: 10, column: 5 });
  });
  it('http 프레임이 없으면 undefined', () => {
    expect(pickTopFrame([{ functionName: 'x', url: 'chrome://x', lineNumber: 0, columnNumber: 0 }])).toBeUndefined();
  });
});

describe('ConsoleCollectorService', () => {
  let service: ConsoleCollectorService;
  let client: EventEmitter & { send: jest.Mock };

  beforeEach(async () => {
    service = new ConsoleCollectorService();
    client = Object.assign(new EventEmitter(), { send: jest.fn(() => Promise.resolve({})) });
    const page = { target: () => ({ createCDPSession: () => Promise.resolve(client) }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await service.attach(page as any);
  });

  it('Runtime.enable 호출 후 console/exception을 누적한다', () => {
    expect(client.send).toHaveBeenCalledWith('Runtime.enable');

    client.emit('Runtime.consoleAPICalled', {
      type: 'error',
      args: [{ type: 'string', value: 'boom' }],
      timestamp: 1,
      stackTrace: { callFrames: [{ functionName: 'f', url: 'http://h/a.js', lineNumber: 2, columnNumber: 3 }] },
    });
    client.emit('Runtime.exceptionThrown', {
      timestamp: 2,
      exceptionDetails: {
        text: 'Uncaught',
        exception: { type: 'object', description: 'TypeError: x is not a function' },
        url: 'http://h/a.js',
        lineNumber: 5,
        columnNumber: 1,
      },
    });

    const snap = service.snapshot();
    expect(snap).toHaveLength(2);
    expect(snap[0]).toMatchObject({ level: 'error', text: 'boom' });
    expect(snap[0].frame).toEqual({ url: 'http://h/a.js', line: 3, column: 4 });
    expect(snap[1]).toMatchObject({ level: 'exception', text: 'TypeError: x is not a function' });
    expect(snap[1].frame).toEqual({ url: 'http://h/a.js', line: 6, column: 2 });
  });

  it('getById로 레코드를 조회하고 clear로 비운다', () => {
    client.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ type: 'string', value: 'hi' }], timestamp: 1 });
    const id = service.snapshot()[0].id;
    expect(service.getById(id)?.text).toBe('hi');
    service.clear();
    expect(service.snapshot()).toHaveLength(0);
  });
});
