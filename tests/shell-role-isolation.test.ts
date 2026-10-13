import { describe, expect, it } from 'vitest';
import { workspaceForPath } from '../src/app/shell';

describe('platform workspace isolation', () => {
  it('keeps a Student on the Student shell when opening a shared simulation route', () => {
    expect(workspaceForPath('/simulation/session-1', { roles: ['Student'] } as never)).toBe('Student');
  });

  it('keeps an Instructor on the Instructor shell for a shared simulation route', () => {
    expect(workspaceForPath('/simulation/session-1', { roles: ['Instructor'] } as never)).toBe('Instructor');
  });

  it('does not let a simulation role name affect platform workspace selection', () => {
    expect(workspaceForPath('/simulation/session-1', { roles: ['Student'], simulationRoleCode: 'Government' } as never)).toBe('Student');
  });
});
