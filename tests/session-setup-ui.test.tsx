import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiClient } from '../src/lib/api/client';
import { AuthSession } from '../src/lib/auth/session';
import { RuntimeProvider } from '../src/app/runtime';
import { createQueryClient } from '../src/lib/api/query';
import { SessionSetupPage } from '../src/features/instructor/sessions';
import { json, sessionId, sessionTransport, tokens, vault } from './helpers';

const base = { session: { id: sessionId, status: 'Draft', currentRound: 1, currentPhase: 'Briefing', version: 1 }, classroom: { id: 'class-1', name: 'Economics 101' }, scenario: { id: 'scenario-1', title: 'Market Simulation', publishedVersion: 1 }, model: { identifier: 'Economics.ShortRunMacro', version: '1.0.0' }, readiness: { isReady: false, blockers: [{ code: 'not_ready' }] } };
const role = { code: 'GOV', name: 'Government', minimumParticipants: 1, maximumParticipants: 1, capabilities: [] };

async function mountSetup(initial: { teams?: unknown[] | null; participants?: unknown[] | null; roleAssignments?: unknown[] | null; failTeamCreate?: boolean; stallSetupAfterCreate?: boolean; delayTeamCreate?: boolean;status?:string } = {}) {
  let teams = initial.teams ?? [];
  let participants = initial.participants ?? [];
  let roleAssignments = initial.roleAssignments ?? [];
  let stallNextSetup = false;
  let isOpen=false;
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input); const method = init?.method ?? 'GET';
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path.endsWith('/auth/login')) return json(tokens('Instructor'));
    if (path.endsWith('/join-requests')) return json([]);
    if (path.endsWith('/setup') && method === 'GET') { if (stallNextSetup) return new Promise<Response>(() => {}); return json({ ...base,session:{...base.session,status:initial.status??'Draft',isOpen}, teams, participants, availableRoles: [role], roleAssignments, readiness: { isReady: false, blockers: [{ code: 'setup_incomplete' }] } }); }
    if(path.endsWith('/open')||path.endsWith('/close')){isOpen=path.endsWith('/open');return new Response(null,{status:204});}
    if (path.endsWith('/teams') && method === 'POST') { if (initial.delayTeamCreate) await new Promise(resolve => setTimeout(resolve, 50)); if (initial.failTeamCreate) return json({ title: 'Team failed', detail: 'Team could not be created.' }, 500); const newTeam = { teamId: 'team-a', name: (calls.at(-1)?.body as { name: string }).name, members: [] }; teams = [...teams, newTeam]; stallNextSetup = !!initial.stallSetupAfterCreate; return json({ id: newTeam.teamId }, 201); }
    if (path.endsWith('/teams/team-a/members')) { const body = calls.at(-1)?.body as { userId: string }; participants = participants.map((p: any) => p.userId === body.userId ? { ...p, teamId: 'team-a' } : p); return new Response(null, { status: 204 }); }
    if (path.includes('/participants/') && path.endsWith('/move')) { const userId = path.split('/participants/')[1].split('/')[0]; const target = (calls.at(-1)?.body as { targetTeamId: string }).targetTeamId; participants = participants.map((p: any) => p.userId === userId ? { ...p, teamId: target } : p); return new Response(null, { status: 204 }); }
    if (path.endsWith('/remove')) { const userId = path.split('/members/')[1].split('/')[0]; participants = participants.map((p: any) => p.userId === userId ? { ...p, teamId: null } : p); return new Response(null, { status: 204 }); }
    if (path.endsWith('/role-assignments') && method === 'POST') { const body = calls.at(-1)?.body as { userId: string; teamId: string; roleCode: string }; roleAssignments = [...roleAssignments.filter((a: any) => a.userId !== body.userId), { assignmentId: 'assignment-1', participantId: 'participant-1', ...body }]; return json({ id: 'assignment-1' }, 201); }
    throw new Error(`Unexpected setup request ${method} ${path}`);
  });
  const api = new ApiClient('', undefined, sessionTransport(transport)); const auth = new AuthSession(api, vault()); const queries = createQueryClient();
  await auth.login({ email: 'instructor@example.test', password: 'fixture-only' });
  const view = render(<RuntimeProvider runtime={{ api, auth, queries }}><MemoryRouter initialEntries={[`/instructor/sessions/${sessionId}/setup`]}><Routes><Route path="/instructor/sessions/:sessionId/setup" element={<SessionSetupPage />} /></Routes></MemoryRouter></RuntimeProvider>);
  return { calls, queries, view };
}

describe('instructor session setup', () => {
  it('opens a classroom session for student entry after a team exists',async()=>{
    const s=await mountSetup({teams:[{teamId:'team-a',name:'Team A',members:[]}]});
    await userEvent.click(await screen.findByRole('button',{name:'Open session for students'}));
    expect(await screen.findByText('Open for classroom members')).toBeVisible();expect(s.calls.some(c=>c.path.endsWith('/open')&&c.method==='POST')).toBe(true);s.view.unmount();s.queries.clear();
  });
  it('assigns an entered student to a team and a scenario role',async()=>{
    const s=await mountSetup({teams:[{teamId:'team-a',name:'Team A',members:[]}],participants:[{participantId:'participant-1',userId:'student-1',teamId:null,isReady:false,displayName:'Alice'}]});
    expect(await screen.findByLabelText('Simulation role for Alice')).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Team for Alice'),'team-a');await waitFor(()=>expect(screen.getByLabelText('Simulation role for Alice')).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText('Simulation role for Alice'),'GOV');await waitFor(()=>expect(screen.getByLabelText('Simulation role for Alice')).toHaveValue('GOV'));
    expect(s.calls.find(c=>c.path.endsWith('/role-assignments'))?.body).toEqual({teamId:'team-a',userId:'student-1',roleCode:'GOV'});s.view.unmount();s.queries.clear();
  });
  it('disables roles already taken by another participant on the same team',async()=>{
    const s=await mountSetup({teams:[{teamId:'team-a',name:'Team A',members:[]}],participants:[{participantId:'participant-1',userId:'student-1',teamId:'team-a',isReady:false,displayName:'Alice'},{participantId:'participant-2',userId:'student-2',teamId:'team-a',isReady:false,displayName:'Bob'}],roleAssignments:[{assignmentId:'a1',participantId:'participant-1',teamId:'team-a',roleCode:'GOV'}]});
    const bob=await screen.findByLabelText('Simulation role for Bob');expect(within(bob).getByRole('option',{name:'Government · Taken'})).toBeDisabled();expect(within(screen.getByLabelText('Simulation role for Alice')).getByRole('option',{name:'Government'})).toBeEnabled();s.view.unmount();s.queries.clear();
  });
  it('locks instructor role editing after a game starts',async()=>{
    const s=await mountSetup({status:'Running',teams:[{teamId:'team-a',name:'Team A',members:[]}],participants:[{participantId:'participant-1',userId:'student-1',teamId:'team-a',isReady:false,displayName:'Alice'}]});
    expect(await screen.findByLabelText('Simulation role for Alice')).toBeDisabled();expect(screen.getByRole('button',{name:'Start session'})).toBeDisabled();expect(screen.getByText('Team and role assignments are locked after the game starts.')).toBeVisible();s.view.unmount();s.queries.clear();
  });
  it('distinguishes no admitted participants from all participants assigned', async () => {
    const empty = await mountSetup();
    expect(await screen.findByText('No students have joined this session yet.')).toBeVisible();
    expect(screen.getByText('Students join the classroom using its classroom code. Classroom members can join when the session is open.')).toBeVisible();
    expect(empty.calls.some(call => call.path.endsWith('/join-code'))).toBe(false);
    expect(screen.queryByText('All participants have been assigned to teams.')).toBeNull();
    empty.view.unmount(); empty.queries.clear();

    const assigned = await mountSetup({ teams: [{ teamId: 'team-a', name: 'Team A', members: [] }], participants: [{ participantId: 'participant-1', userId: 'user-1', displayName: 'Ama Mensah', teamId: 'team-a', isReady: false }] });
    expect(await screen.findByText('All participants have been assigned to teams.')).toBeVisible();
    expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThan(0);
    assigned.queries.clear();
  });

  it('creates a team, returns the button to idle, and keeps the created card visible', async () => {
    const s = await mountSetup({ delayTeamCreate: true });
    await screen.findByText('No students have joined this session yet.');
    await userEvent.type(screen.getByLabelText('New team name'), 'Team A');
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }));
    // The mutation should expose its pending state while the POST is in flight.
    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(await screen.findByRole('heading', { name: 'Team A' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create team' })).toBeEnabled());
    expect(s.calls.filter(call => call.path.endsWith('/teams') && call.method === 'POST')).toHaveLength(1);
    s.queries.clear();
  });

  it('ends loading after create failure and keeps the control usable', async () => {
    const s = await mountSetup({ failTeamCreate: true });
    await screen.findByText('No students have joined this session yet.');
    await userEvent.type(screen.getByLabelText('New team name'), 'Team A');
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }));
    expect(await screen.findByText('Team could not be created.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create team' })).toBeEnabled();
    s.queries.clear();
  });

  it('does not keep create pending while background setup recovery is stalled', async () => {
    const s = await mountSetup({ stallSetupAfterCreate: true });
    await screen.findByText('No students have joined this session yet.');
    await userEvent.type(screen.getByLabelText('New team name'), 'Team A');
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create team' })).toBeEnabled());
    expect(s.calls.filter(call => call.path.endsWith('/setup') && call.method === 'GET').length).toBeGreaterThanOrEqual(2);
    s.queries.clear();
  });

  it('uses the full participants collection for assignment and role selection', async () => {
    const s = await mountSetup({ teams: [{ teamId: 'team-a', name: 'Team A', members: [] }], participants: [{ participantId: 'participant-1', userId: 'user-1', displayName: 'Ama Mensah', teamId: null, isReady: false }] });
    expect((await screen.findAllByText('Ama Mensah')).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Team for Ama Mensah'), 'team-a');
    await waitFor(() => expect(s.calls.some(call => call.path.endsWith('/teams/team-a/members') && (call.body as { userId: string }).userId === 'user-1')).toBe(true));
    await waitFor(() => expect(screen.getByText('All participants have been assigned to teams.')).toBeVisible());
    expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Simulation role for Ama Mensah'), 'GOV');
    await waitFor(() => expect(s.calls.some(call => call.path.endsWith('/role-assignments') && call.method === 'POST' && (call.body as { roleCode: string }).roleCode === 'GOV')).toBe(true));
    await waitFor(() => expect(screen.getByLabelText('Simulation role for Ama Mensah')).toHaveValue('GOV'));
    expect(screen.getByRole('option', { name: 'Government' })).toBeInTheDocument();
    s.queries.clear();
  });

  it('moves a participant between teams and removes them from the team using refreshed state', async () => {
    const s = await mountSetup({
      teams: [{ teamId: 'team-a', name: 'Team A', members: [] }, { teamId: 'team-b', name: 'Team B', members: [] }],
      participants: [{ participantId: 'participant-1', userId: 'user-1', displayName: 'Ama Mensah', teamId: 'team-a', isReady: false }],
    });
    expect((await screen.findAllByText('Team A')).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Team for Ama Mensah'), 'team-b');
    await waitFor(() => expect(s.calls.some(call => call.path.endsWith('/participants/user-1/move') && (call.body as { targetTeamId: string }).targetTeamId === 'team-b')).toBe(true));
    await waitFor(() => expect(screen.getAllByText('Team B').length).toBeGreaterThan(0));
    await userEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
    await waitFor(() => expect(s.calls.some(call => call.path.includes('/members/user-1/remove'))).toBe(true));
    await waitFor(() => expect(screen.getByText('Assign these students to teams.')).toBeVisible());
    s.queries.clear();
  });

  it('recovers team and simulation-role assignment from the server on a fresh page load', async () => {
    const s = await mountSetup({
      teams: [{ teamId: 'team-a', name: 'Team A', members: [] }],
      participants: [{ participantId: 'participant-1', userId: 'user-1', displayName: 'Ama Mensah', teamId: 'team-a', isReady: true }],
      roleAssignments: [{ assignmentId: 'assignment-1', participantId: 'participant-1', teamId: 'team-a', roleCode: 'GOV', effectiveCapabilities: [] }],
    });
    expect((await screen.findAllByText('Ama Mensah')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Simulation role for Ama Mensah')).toHaveValue('GOV');
    expect(s.calls.some(call => call.path.endsWith('/setup') && call.method === 'GET')).toBe(true);
    s.queries.clear();
  });
});
