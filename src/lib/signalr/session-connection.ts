import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'expired';
export const sessionEvents = ['SessionStateChanged', 'TeamChanged', 'ParticipantChanged', 'ActionSubmitted', 'ResultsAvailable', 'ParticipantJoined', 'RoleAssignmentChanged', 'ParticipantReadyChanged', 'RoundPhaseChanged', 'SessionPaused', 'SessionResumed', 'ActionSubmissionStatusChanged'] as const;
export interface Connection {
  start(): Promise<void>; stop(): Promise<void>; invoke(method: string, ...args: unknown[]): Promise<unknown>;
  on(name: string, handler: (...args: unknown[]) => void): void;
  off(name: string, handler: (...args: unknown[]) => void): void;
  onreconnecting(handler: () => void): void; onreconnected(handler: () => void): void; onclose(handler: () => void): void;
}
export function createConnection(origin: string, accessTokenFactory: () => Promise<string>) {
  return new HubConnectionBuilder().withUrl(`${origin}/hubs/sessions`, { accessTokenFactory })
    .withAutomaticReconnect([0, 2_000, 10_000, 30_000]).configureLogging(LogLevel.None).build();
}
/** One dedicated connection per mounted session. stop() also removes the backend's team group. */
export class SessionConnection {
  private disposed = false;
  private started = false;
  private pending: Promise<void> | null = null;
  private changed = () => { void this.invalidate().catch(this.onRecoveryError); };
  constructor(private connection: Connection, private sessionId: string,
    private invalidate: () => Promise<void>, private recover: () => Promise<void>,
    private status: (status: ConnectionStatus) => void, private onRecoveryError: (error: unknown) => void) {
    sessionEvents.forEach(event => connection.on(event, this.changed));
    connection.onreconnecting(() => { if (!this.disposed) this.status('reconnecting'); });
    connection.onreconnected(() => { void this.joinAndRecover().catch(onRecoveryError); });
    connection.onclose(() => { this.started = false; if (!this.disposed) this.status('disconnected'); });
  }
  private async joinAndRecover() {
    if (this.disposed) return;
    this.status('reconnecting');
    try {
      await this.connection.invoke('JoinSession', this.sessionId);
      if (this.disposed) return;
      await this.recover();
      if (!this.disposed) this.status('connected');
    } catch (error) { if (!this.disposed) this.status('disconnected'); throw error; }
  }
  start(): Promise<void> {
    if (this.disposed || this.started) return Promise.resolve();
    return this.pending ??= (async () => {
      this.status('reconnecting');
      try { await this.connection.start(); this.started = true; await this.joinAndRecover(); }
      catch (error) { this.status('disconnected'); this.onRecoveryError(error); }
      finally { this.pending = null; }
    })();
  }
  async dispose() {
    this.disposed = true;
    sessionEvents.forEach(event => this.connection.off(event, this.changed));
    await this.connection.stop();
    await this.pending;
    if (this.started) await this.connection.stop();
  }
}
