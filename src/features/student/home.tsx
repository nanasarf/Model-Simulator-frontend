import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useRuntime } from "../../app/runtime";
import { courseService } from "../courses/service";
import { keys } from "../../lib/api/query";
import { EmptyState, ErrorState, LoadingState } from "../../components/states";

function classroomRequestLabel(status: string) {
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

export function StudentHome() {
  const { api } = useRuntime();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [classCode, setClassCode] = useState("");

  const join = useMutation({
    mutationFn: () => courseService(api).joinSession(code.trim()),
    onSuccess: (result) => navigate(`/simulation/${result.sessionId}`),
  });

  const classroom = useMutation({
    mutationFn: () => courseService(api).requestClassroomJoin(classCode.trim()),
    onSuccess: () => setClassCode(""),
  });

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Student workspace</p>
        <h1>Ready for a new perspective?</h1>
        <p>Request classroom access, then open an assigned simulation.</p>
      </header>

      <section className="card">
        <h2>Join a classroom</h2>
        <p>
          Enter the code shared by your instructor. Your request must be
          approved.
        </p>
        <form
          className="input-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (classCode.trim()) classroom.mutate();
          }}
        >
          <label htmlFor="classroom-code">Classroom code</label>
          <input
            id="classroom-code"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.toUpperCase())}
            autoComplete="off"
            required
          />
          <button disabled={classroom.isPending}>
            {classroom.isPending ? "Sending…" : "Request to join"}
          </button>
        </form>
        {classroom.data && (
          <p role="status">{classroomRequestLabel(classroom.data.status)}</p>
        )}
        {classroom.error && <ErrorState error={classroom.error} />}
      </section>

      <section className="card">
        <h2>Join a live session</h2>
        <form
          className="input-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) join.mutate();
          }}
        >
          <label htmlFor="join-code">Session code</label>
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            required
          />
          <button disabled={join.isPending}>
            {join.isPending ? "Joining…" : "Join session"}
          </button>
        </form>
        {join.error && <ErrorState error={join.error} />}
      </section>

      <SessionsPage />
    </>
  );
}

export function SessionsPage() {
  const { api } = useRuntime();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: keys.mySessions(user!.id),
    queryFn: ({ signal }) => courseService(api).mySessions(signal),
  });

  if (q.isPending) return <LoadingState label="Loading your sessions" />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;

  return (
    <section>
      <div className="section-heading">
        <h2>My sessions</h2>
      </div>
      {q.data.length === 0 ? (
        <EmptyState title="No assigned sessions">
          <p>Your instructor will add you to a classroom simulation.</p>
        </EmptyState>
      ) : (
        <div className="card-grid">
          {q.data.map((s) => (
            <article className="card" key={s.sessionId}>
              <p className="eyebrow">{s.status}</p>
              <h3>{s.scenarioTitle}</h3>
              <p>
                {s.classroomName} · {s.modelIdentifier}:{s.modelVersion}
              </p>
              <p>
                Round {s.currentRound} · {s.currentPhase}
                {s.teamId ? ` · Team ${s.teamId}` : ""}
              </p>
              <Link to={`/simulation/${s.sessionId}`}>Open session</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
