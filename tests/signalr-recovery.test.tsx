import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionConnection, sessionEvents, type Connection } from '../src/lib/signalr/session-connection';
import { createQueryClient, invalidateSession, keys } from '../src/lib/api/query';
import { recoverContext } from '../src/features/simulation/context';
import { resolveModelUI } from '../src/features/simulation/registry';
import { MacroWorkspace } from '../src/features/short-run-macro/adapter';
import { MarketWorkspace } from '../src/features/competitive-market/adapter';
import { recovery, userId, sessionId } from './helpers';
function connection() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  let reconnect!: () => void, reconnecting!: () => void, close!: () => void;
  const hub: Connection = {
    start: vi.fn(async () => {}), stop: vi.fn(async () => {}), invoke: vi.fn(async () => {}),
    on: vi.fn((name, handler) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(handler); }),
    off: vi.fn((name, handler) => { listeners.get(name)?.delete(handler); }),
    onreconnected: fn => { reconnect = fn; }, onreconnecting: fn => { reconnecting = fn; }, onclose: fn => { close = fn; },
  };
  return { hub, listeners, reconnect: () => reconnect(), reconnecting: () => reconnecting(), close: () => close(), emit: (name: string) => listeners.get(name)?.forEach(fn => fn({ messageId: 'notification' })) };
}
describe('SignalR recovery', () => {
  it('joins before authoritative recovery on start and reconnect', async () => {
    const fake = connection(); const order: string[] = []; fake.hub.invoke = vi.fn(async () => { order.push('join'); });
    const recover = vi.fn(async () => { order.push('recover'); }); const status = vi.fn();
    const live = new SessionConnection(fake.hub, sessionId, vi.fn(), recover, status, vi.fn());
    await live.start(); fake.reconnect(); await vi.waitFor(() => expect(recover).toHaveBeenCalledTimes(2));
    expect(order).toEqual(['join', 'recover', 'join', 'recover']); expect(fake.hub.invoke).toHaveBeenCalledWith('JoinSession', sessionId); expect(status).toHaveBeenLastCalledWith('connected'); await live.dispose();
  });
  it('events invalidate only the intended session cache without changing state from payload', async () => {
    const client = createQueryClient(); client.setQueryData(keys.state(userId, sessionId), recovery); client.setQueryData(keys.state(userId, 'other'), { status: 'Paused' }); client.setQueryData(keys.models, []);
    const fake = connection(); const live = new SessionConnection(fake.hub, sessionId, () => invalidateSession(client, userId, sessionId), vi.fn(), vi.fn(), vi.fn());
    fake.emit('ActionSubmissionStatusChanged'); await vi.waitFor(() => expect(client.getQueryState(keys.state(userId, sessionId))?.isInvalidated).toBe(true));
    expect(client.getQueryState(keys.state(userId, 'other'))?.isInvalidated).toBe(false); expect(client.getQueryState(keys.models)?.isInvalidated).toBe(false); expect(client.getQueryData(keys.state(userId, sessionId))).toEqual(recovery); await live.dispose(); client.clear();
  });
  it('repeated start and reconnect never register duplicate handlers; disposal removes every handler', async () => {
    const fake = connection(); const invalidate = vi.fn(async () => {}); const live = new SessionConnection(fake.hub, sessionId, invalidate, vi.fn(), vi.fn(), vi.fn());
    await Promise.all([live.start(), live.start()]); fake.reconnect(); await Promise.resolve();
    expect(fake.hub.on).toHaveBeenCalledTimes(sessionEvents.length); fake.emit('ResultsAvailable'); expect(invalidate).toHaveBeenCalledTimes(1);
    await live.dispose(); expect([...fake.listeners.values()].every(x => x.size === 0)).toBe(true); fake.emit('ResultsAvailable'); expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it('transient disconnect is independent from session expiration', async () => {
    const fake = connection(); const status = vi.fn(); const live = new SessionConnection(fake.hub, sessionId, vi.fn(), vi.fn(), status, vi.fn()); await live.start();
    fake.reconnecting(); expect(status).toHaveBeenLastCalledWith('reconnecting'); fake.close(); expect(status).toHaveBeenLastCalledWith('disconnected'); expect(status).not.toHaveBeenCalledWith('expired'); await live.dispose();
  });
  it('failed group rejoin cannot claim connected status', async () => {
    const fake = connection(); fake.hub.invoke = vi.fn().mockRejectedValue(new Error('session.not_found')); const status = vi.fn(), error = vi.fn(), recover = vi.fn();
    const live = new SessionConnection(fake.hub, sessionId, vi.fn(), recover, status, error); await live.start(); expect(status).toHaveBeenLastCalledWith('disconnected'); expect(error).toHaveBeenCalled(); expect(recover).not.toHaveBeenCalled(); await live.dispose();
  });
});
describe('session recovery and model boundary', () => {
  it('restores phase, round, role, team and participant readiness from REST after refresh', () => { expect(recoverContext(recovery, userId)).toMatchObject({ phase: 'Decision', roundNumber: 2, roleCodes: ['BUYER'], teamId: recovery.teamId, participantReady: true, capabilities: null, model: null, roundReadiness: null }); });
  it('does not confuse participant readiness with round readiness', () => { expect(recoverContext(recovery, userId).roundReadiness).toBeNull(); });
  it('resolves exact macro and market registry identities to different typed adapters', () => {
    expect(resolveModelUI('Economics.ShortRunMacro', '1.0.0')?.Workspace).toBe(MacroWorkspace);
    expect(resolveModelUI('Economics.CompetitiveMarket', '1.0.0')?.Workspace).toBe(MarketWorkspace);
    expect(resolveModelUI('economics.shortrunmacro', '1.0.0')).toBeUndefined(); expect(resolveModelUI('Economics.ShortRunMacro', '2.0.0')).toBeUndefined();
  });
  it('macro adapter accepts its typed authorized projection without exposing economics', () => { render(<MacroWorkspace projection={{ quarter: 2, outputIndex: 101, inflation: 2, unemployment: 5 }}/>); expect(screen.getByText('Short-Run Macroeconomics')).toBeVisible(); expect(screen.queryByText('101')).not.toBeInTheDocument(); });
  it('market adapter does not display the current backend private payload', () => { render(<MarketWorkspace projection={{ round: 2, lastResult: null, buyerInformation: [{ valuation: 9999, quantityAvailable: 1 }] }}/>); expect(screen.getByText('Competitive Market')).toBeVisible(); expect(screen.queryByText('9999')).not.toBeInTheDocument(); });
});
