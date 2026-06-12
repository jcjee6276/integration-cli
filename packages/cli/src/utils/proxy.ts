import * as http from 'http';
import * as net from 'net';

export interface ProxyServerOptions {
  port: number;
  serverPort: number;
  webPort: number;
}

// NestJS 컨트롤러/게이트웨이가 사용하는 경로 prefix. 나머지는 모두 Next.js로 보낸다.
const BACKEND_PREFIXES = [
  'agents',
  'tasks',
  'fs',
  'harness',
  'sessions',
  'conversations',
  'docs',
  'docs-json',
  'socket.io',
];

function isBackendPath(url: string): boolean {
  const pathname = url.split('?')[0] ?? '';
  return BACKEND_PREFIXES.some(
    (prefix) => pathname === `/${prefix}` || pathname.startsWith(`/${prefix}/`),
  );
}

export function startProxyServer(options: ProxyServerOptions): Promise<http.Server> {
  const { port, serverPort, webPort } = options;

  const resolveTargetPort = (url: string | undefined): number =>
    isBackendPath(url ?? '/') ? serverPort : webPort;

  const server = http.createServer((req, res) => {
    try {
      const targetPort = resolveTargetPort(req.url);
      const proxyReq = http.request(
        {
          host: '127.0.0.1',
          port: targetPort,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );

      proxyReq.on('error', () => {
        try {
          if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
          }
          res.end('업스트림 서버가 아직 준비되지 않았습니다. 잠시 후 새로고침해 주세요.');
        } catch {
          res.destroy();
        }
      });

      req.pipe(proxyReq);
    } catch {
      res.destroy();
    }
  });

  // WebSocket(socket.io, Next.js HMR) 업그레이드 요청을 원본 헤더 그대로 터널링한다.
  server.on('upgrade', (req, socket, head) => {
    try {
      const targetPort = resolveTargetPort(req.url);
      const upstream = net.connect(targetPort, '127.0.0.1', () => {
        const headerLines = [`${req.method} ${req.url} HTTP/1.1`];
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
        }
        upstream.write(`${headerLines.join('\r\n')}\r\n\r\n`);
        if (head.length > 0) upstream.write(head);
        socket.pipe(upstream).pipe(socket);
      });

      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
    } catch {
      socket.destroy();
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

export function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    const tryConnect = (): void => {
      const socket = net.connect(port, '127.0.0.1');

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          resolve(false);
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };

    tryConnect();
  });
}
