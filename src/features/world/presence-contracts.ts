/** SignalR /hubs/world JSON protocol v1. UUIDs and UTC ISO timestamps are strings. */
export type Facing = 'north' | 'east' | 'south' | 'west';
export type Movement = 'idle' | 'moving';
export interface WorldMove {
  protocolVersion: 1; sessionId: string; epoch: string; leaseId: string;
  sequence: number; x: number; y: number; facing: Facing; movement: Movement;
}
export interface PresencePlayer {
  playerId: string; teamId: string | null; x: number; y: number;
  facing: Facing; movement: Movement; sequence: number; serverTimestamp: string;
}
export interface PresenceSnapshot {
  protocolVersion: 1; sessionId: string; epoch: string; revision: number;
  geometryVersion: string; playerId: string; leaseId: string; players: PresencePlayer[];
}
export interface PresenceEvent {
  protocolVersion: 1; sessionId: string; epoch: string; revision: number;
  kind: 'joined' | 'moved' | 'updated' | 'left'; player: PresencePlayer; serverTimestamp: string;
}
export interface PresenceRecovery { protocolVersion: 1; sessionId: string }
export interface WorldPresenceMethods {
  EnterWorld(sessionId: string): Promise<PresenceSnapshot>;
  RecoverWorld(request: PresenceRecovery): Promise<PresenceSnapshot>;
  MoveWorld(request: WorldMove): Promise<PresencePlayer>;
  LeaveWorld(sessionId: string): Promise<void>;
}
export interface WorldPresenceEvents {
  WorldPresenceChanged(event: PresenceEvent): void;
}
