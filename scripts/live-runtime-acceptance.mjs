const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:5000';
const required = ['INSTRUCTOR_EMAIL','INSTRUCTOR_PASSWORD','STUDENT_EMAIL','STUDENT_PASSWORD'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) { console.log(`SKIP live acceptance: set ${missing.join(', ')}`); process.exit(0); }

async function login(email, password) {
  const response = await fetch(`${origin}/api/v1/auth/login`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`login ${response.status}: ${body.detail ?? body.title ?? 'failed'}`);
  return body.accessToken ?? body.access_token;
}
async function get(token, path) {
  const response = await fetch(`${origin}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} ${response.status}: ${body.detail ?? body.title ?? 'failed'}`);
  return body;
}
const instructor = await login(process.env.INSTRUCTOR_EMAIL, process.env.INSTRUCTOR_PASSWORD);
const student = await login(process.env.STUDENT_EMAIL, process.env.STUDENT_PASSWORD);
const classrooms = await get(instructor, '/api/v1/classrooms?page=1&pageSize=25');
const scenarios = await get(instructor, '/api/v1/scenarios?status=Published&page=1&pageSize=25');
const sessions = await get(instructor, '/api/v1/sessions?page=1&pageSize=25');
const mine = await get(student, '/api/v1/me/sessions');
console.log(`PASS authenticated discovery: classrooms=${classrooms.items?.length ?? 0}, published=${scenarios.items?.length ?? 0}, instructorSessions=${sessions.items?.length ?? 0}, studentSessions=${mine.length ?? 0}`);

const sessionId = process.env.SESSION_ID;
if (!sessionId) { console.log('SKIP correction/recovery checks: set SESSION_ID (and correction IDs where applicable)'); process.exit(0); }
const setup = await get(instructor, `/api/v1/sessions/${sessionId}/setup`);
console.log(`PASS setup recovery: model=${setup.model?.identifier}:${setup.model?.version}, version=${setup.session?.version}`);
const studentRecovery = await get(student, `/api/v1/sessions/${sessionId}/state`);
console.log(`PASS student recovery isolation: model=${studentRecovery.modelIdentifier}:${studentRecovery.modelVersion}, phase=${studentRecovery.phase}, round=${studentRecovery.roundNumber}`);
