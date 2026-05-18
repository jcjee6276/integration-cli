import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

import { Injectable, Logger } from '@nestjs/common';

export interface AuthStatus {
  loggedIn: boolean;
  authMethod: string;
  apiProvider: string;
  email?: string;
  orgName?: string;
  subscriptionType?: string;
}

@Injectable()
export class ClaudeAuthManager {
  private readonly logger = new Logger(ClaudeAuthManager.name);
  private readonly loginProcesses = new Map<string, ChildProcess>();

  async getAuthStatus(): Promise<AuthStatus> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['auth', 'status'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let output = '';
      proc.stdout.on('data', (d: Buffer) => (output += d.toString()));
      proc.stderr.on('data', (d: Buffer) => (output += d.toString()));

      proc.on('close', () => {
        try {
          resolve(JSON.parse(output.trim()) as AuthStatus);
        } catch {
          resolve({ loggedIn: false, authMethod: 'unknown', apiProvider: 'firstParty' });
        }
      });

      proc.on('error', () => {
        resolve({ loggedIn: false, authMethod: 'unknown', apiProvider: 'firstParty' });
      });
    });
  }

  startLogin(
    clientId: string,
    onOutput: (text: string) => void,
    onDone: (success: boolean) => void,
  ): void {
    this.cancelLogin(clientId);

    const proc = spawn('claude', ['auth', 'login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    this.loginProcesses.set(clientId, proc);
    this.logger.log(`Started login process for client ${clientId} (pid: ${proc.pid})`);

    proc.stdout.on('data', (chunk: Buffer) => onOutput(chunk.toString()));
    proc.stderr.on('data', (chunk: Buffer) => onOutput(chunk.toString()));

    proc.on('close', (code) => {
      this.loginProcesses.delete(clientId);
      this.logger.log(`Login process for ${clientId} exited with code ${code}`);
      onDone(code === 0);
    });

    proc.on('error', (err) => {
      this.loginProcesses.delete(clientId);
      this.logger.error(`Login process error for ${clientId}: ${err.message}`);
      onDone(false);
    });
  }

  cancelLogin(clientId: string): void {
    const proc = this.loginProcesses.get(clientId);
    if (proc) {
      proc.kill();
      this.loginProcesses.delete(clientId);
    }
  }
}
