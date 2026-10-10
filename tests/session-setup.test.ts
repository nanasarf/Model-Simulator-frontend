import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/lib/api/client';
import { courseService } from '../src/features/courses/service';

const base = { session: { id: 's', status: 'Draft', currentRound: 1, currentPhase: 'Briefing', version: 1 }, classroom: { id: 'c', name: 'Class' }, scenario: { id: 'sc', title: 'Scenario', publishedVersion: 1 }, model: { identifier: 'Economics.ShortRunMacro', version: '1.0.0' } };

function setupApi(body: unknown) {
  return new ApiClient('', undefined, vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })));
}

describe('session setup collection normalization', () => {
  it('normalizes null collections and readiness blockers', async () => {
    const result = await courseService(setupApi({ ...base, teams: null, participants: null, availableRoles: null, roleAssignments: null, readiness: null })).setup('s');
    expect(result.teams).toEqual([]); expect(result.participants).toEqual([]); expect(result.availableRoles).toEqual([]); expect(result.roleAssignments).toEqual([]); expect(result.readiness).toEqual({ isReady: false, blockers: [] });
  });

  it('preserves empty collections', async () => {
    const result = await courseService(setupApi({ ...base, teams: [], participants: [], availableRoles: [], roleAssignments: [], readiness: { isReady: false, blockers: [] } })).setup('s');
    expect(result.teams).toEqual([]); expect(result.participants).toEqual([]); expect(result.availableRoles).toEqual([]); expect(result.roleAssignments).toEqual([]); expect(result.readiness.blockers).toEqual([]);
  });

  it('preserves populated setup collections', async () => {
    const team = { teamId: 't', name: 'Team A', members: ['u'] }; const participant = { participantId: 'p', userId: 'u', teamId: 't', isReady: false }; const role = { code: 'role', name: 'Role', minimumParticipants: 1, maximumParticipants: 2, capabilities: [] };
    const result = await courseService(setupApi({ ...base, teams: [team], participants: [participant], availableRoles: [role], roleAssignments: [], readiness: { isReady: false, blockers: [{ code: 'not_ready' }] } })).setup('s');
    expect(result.teams).toEqual([team]); expect(result.participants).toEqual([participant]); expect(result.availableRoles).toEqual([role]); expect(result.readiness.blockers).toEqual([{ code: 'not_ready' }]);
  });
});
