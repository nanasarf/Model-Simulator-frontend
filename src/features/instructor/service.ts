import type { ApiClient } from '../../lib/api/client';
import type { MacroInstructorConsole } from '../../types/short-run-macro';
import type { MarketInstructorConsole } from '../../types/competitive-market';
import type { CurrentUser } from '../../types/auth';
import { isInstructor } from '../../lib/permissions';
import { ApiProblem } from '../../lib/errors/problem';
export function instructorService(api: ApiClient, user: CurrentUser | null) {
  const check = () => { if (!isInstructor(user)) throw new ApiProblem(403, 'about:blank', 'Access denied', 'Instructor access is required.'); };
  return {
    macroConsole(id: string, signal?: AbortSignal) { check(); return api.json<MacroInstructorConsole>(`/api/v1/economics/macro/sessions/${encodeURIComponent(id)}/console`, { signal }); },
    marketConsole(id: string, signal?: AbortSignal) { check(); return api.json<MarketInstructorConsole>(`/api/v1/economics/competitive-market/sessions/${encodeURIComponent(id)}/console`, { signal }); },
    macroCsv(id: string, signal?: AbortSignal) { check(); return api.download(`/api/v1/economics/macro/sessions/${encodeURIComponent(id)}/report?format=csv`, signal); },
  };
}
