import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useRuntime } from "../../app/runtime";
import { courseService } from "../courses/service";
import { keys } from "../../lib/api/query";
import {
  BackgroundStatus,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/states";
import type {
  ClassroomJoinRequest,
  ClassroomSummary,
} from "../../types/classrooms";

function classroomRequestStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending") return "Pending";
  if (normalized === "enrolled" || normalized === "approved") return "Enrolled";
  if (
    normalized === "rejected" ||
    normalized === "not approved" ||
    normalized === "denied"
  ) {
    return "Not approved";
  }
  return status;
}

export function ClassroomListPage() {
  const { api } = useRuntime();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [classroomName, setClassroomName] = useState("");
  const q = useQuery({
    queryKey: keys.classrooms(user!.id, page, 25),
    queryFn: ({ signal }) => courseService(api).classrooms(page, 25, signal),
  });
  const create = useMutation({
    mutationFn: async () => {
      const service = courseService(api);
      const course = await service.create({
        code: courseCode.trim(),
        name: courseName.trim(),
      });
      return service.createClassroom(course.id, { name: classroomName.trim() });
    },
    onSuccess: () => {
      setCourseName("");
      setCourseCode("");
      setClassroomName("");
      void qc.invalidateQueries({ queryKey: ["user", user!.id, "classrooms"] });
    },
  });
  if (q.isPending) return <LoadingState label="Loading classrooms" />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Instructor workspace</p>
        <h1>Classrooms</h1>
        <p>Manage the classrooms used for your simulations.</p>
      </header>
      <section className="card">
        <h2>Create classroom</h2>
        <form
          className="input-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (courseName && courseCode && classroomName) create.mutate();
          }}
        >
          <label htmlFor="course-code">Course code</label>
          <input
            id="course-code"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            required
          />
          <label htmlFor="course-name">Course name</label>
          <input
            id="course-name"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required
          />
          <label htmlFor="classroom-name">Classroom name</label>
          <input
            id="classroom-name"
            value={classroomName}
            onChange={(e) => setClassroomName(e.target.value)}
            required
          />
          <button disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create classroom"}
          </button>
        </form>
        {create.error && <ErrorState error={create.error} />}
      </section>
      {q.data.items.length === 0 ? (
        <EmptyState title="No classrooms">
          <p>Create your first classroom above.</p>
        </EmptyState>
      ) : (
        <>
          <div className="card-grid">
            {q.data.items.map((c) => (
              <ClassroomCard key={c.classroomId} classroom={c} />
            ))}
          </div>
          <Pagination
            page={q.data.page}
            pageSize={q.data.pageSize}
            total={q.data.totalCount}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
function ClassroomCard({ classroom }: { classroom: ClassroomSummary }) {
  return (
    <article className="card">
      <p className="eyebrow">{classroom.courseCode}</p>
      <h2>{classroom.name}</h2>
      <p>{classroom.courseName}</p>
      <Link to={`/instructor/classrooms/${classroom.classroomId}`}>
        Open classroom
      </Link>
    </article>
  );
}
export function ClassroomDetailPage() {
  const { api } = useRuntime();
  const { user } = useAuth();
  const { classroomId = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: keys.classroom(user!.id, classroomId),
    queryFn: ({ signal }) => courseService(api).classroom(classroomId, signal),
  });
  const joinCode = useQuery({
    queryKey: keys.classroomJoinCode(user!.id, classroomId),
    queryFn: ({ signal }) =>
      courseService(api).classroomJoinCode(classroomId, signal),
    enabled: !!q.data,
  });
  const joinRequests = useQuery({
    queryKey: keys.classroomJoinRequests(user!.id, classroomId),
    queryFn: ({ signal }) =>
      courseService(api).joinRequests(classroomId, signal),
    enabled: !!q.data,
  });
  const roster = useQuery({
    queryKey: keys.roster(user!.id, classroomId),
    queryFn: ({ signal }) => courseService(api).roster(classroomId, signal),
    enabled: !!q.data,
  });
  const sessions = useQuery({
    queryKey: keys.sessionLists(user!.id, 1, 25, classroomId, "", ""),
    queryFn: ({ signal }) =>
      courseService(api).sessions(
        { classroomId, page: 1, pageSize: 25 },
        signal,
      ),
    enabled: !!q.data,
  });
  const refreshMembership = () => {
    void qc.invalidateQueries({
      queryKey: keys.classroomJoinRequests(user!.id, classroomId),
    });
    void qc.invalidateQueries({ queryKey: keys.roster(user!.id, classroomId) });
  };
  const approve = useMutation({
    mutationFn: (requestId: string) =>
      courseService(api).approveJoin(classroomId, requestId),
    onSuccess: refreshMembership,
  });
  const reject = useMutation({
    mutationFn: (requestId: string) =>
      courseService(api).rejectJoin(classroomId, requestId),
    onSuccess: refreshMembership,
  });
  if (q.isPending) return <LoadingState label="Loading classroom" />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Classroom</p>
        <h1>{q.data.name}</h1>
        <p>
          {q.data.courseName} · {q.data.courseCode}
        </p>
        <Link
          className="button-link"
          to={`/instructor/scenarios?show=Ready&launchFor=${classroomId}`}
        >
          Start a Simulation
        </Link>
      </header>
      <section className="card">
        <div className="section-heading">
          <h2>Classroom code</h2>
        </div>
        {joinCode.isPending ? (
          <LoadingState label="Loading classroom code" />
        ) : joinCode.isError ? (
          <ErrorState
            error={joinCode.error}
            retry={() => void joinCode.refetch()}
          />
        ) : joinCode.data?.active ? (
          <>
            <p className="session-code">
              Classroom code <strong>{joinCode.data.joinCode}</strong>
            </p>
            <p className="muted">
              Students use this code to request classroom access.
            </p>
          </>
        ) : (
          <p>This classroom code is not active right now.</p>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Pending requests</h2>
          <BackgroundStatus active={joinRequests.isFetching} />
        </div>
        {joinRequests.isPending ? (
          <LoadingState label="Loading join requests" />
        ) : joinRequests.isError ? (
          <ErrorState
            error={joinRequests.error}
            retry={() => void joinRequests.refetch()}
          />
        ) : joinRequests.data.length === 0 ? (
          <EmptyState title="No pending requests">
            <p>Student requests to join this classroom will appear here.</p>
          </EmptyState>
        ) : (
          <div className="card-grid">
            {joinRequests.data.map((request: ClassroomJoinRequest) => (
              <article className="card" key={request.id}>
                <p className="eyebrow">
                  {classroomRequestStatusLabel(request.status)}
                </p>
                <h3>{request.studentUserId}</h3>
                <p className="muted">
                  Requested {new Date(request.requestedAt).toLocaleString()}
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => approve.mutate(request.id)}
                    disabled={approve.isPending || reject.isPending}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => reject.mutate(request.id)}
                    disabled={approve.isPending || reject.isPending}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Roster</h2>
          <BackgroundStatus active={roster.isFetching} />
        </div>
        {roster.isPending ? (
          <LoadingState label="Loading roster" />
        ) : roster.isError ? (
          <ErrorState
            error={roster.error}
            retry={() => void roster.refetch()}
          />
        ) : roster.data.length === 0 ? (
          <EmptyState title="No enrolled students">
            <p>The backend returned an empty roster.</p>
          </EmptyState>
        ) : (
          <div className="card-grid">
            {roster.data.map((s) => (
              <article className="card" key={s.participantUserId}>
                <h3>{s.userName || s.email || s.participantUserId}</h3>
                <p>{s.email}</p>
                <p className="muted">
                  Enrolled {new Date(s.enrolledAt).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Simulation sessions</h2>
        </div>
        {sessions.isPending ? (
          <LoadingState label="Loading sessions" />
        ) : sessions.isError ? (
          <ErrorState
            error={sessions.error}
            retry={() => void sessions.refetch()}
          />
        ) : sessions.data.items.length === 0 ? (
          <EmptyState title="No sessions">
            <p>Launch a published scenario to create the first session.</p>
          </EmptyState>
        ) : (
          <div className="card-grid">
            {sessions.data.items.map((s) => (
              <article className="card" key={s.sessionId}>
                <p className="eyebrow">{s.status}</p>
                <h3>{s.scenarioTitle}</h3>
                <p>
                  {s.modelIdentifier}:{s.modelVersion} · {s.currentPhase} ·
                  Round {s.currentRound}
                </p>
                <Link
                  to={
                    s.status === "Draft"
                      ? `/instructor/sessions/${s.sessionId}/setup`
                      : `/simulation/${s.sessionId}`
                  }
                >
                  {s.status === "Draft" ? "Open setup" : "Open runtime"}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const max = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="button-row" aria-label="Pagination">
      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {max}
      </span>
      <button
        className="secondary"
        disabled={page >= max}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
