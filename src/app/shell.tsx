import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import { useAuth, useRuntime } from "./runtime";
import { hasPlatformRole, isInstructor } from "../lib/permissions";
import type { ConnectionStatus } from "../lib/signalr/session-connection";

type WorkspaceMode = "Instructor" | "Student";
type TopMenu = "workspace" | "account" | null;

const ConnectionContext = createContext<
  Dispatch<SetStateAction<ConnectionStatus | null>>
>(() => {});

export const useConnectionStatus = () => useContext(ConnectionContext);

export function ConnectionLabel({
  status,
}: {
  status: ConnectionStatus | null;
}) {
  const labels = {
    connected: "Connected",
    reconnecting: "Reconnecting…",
    disconnected: "Disconnected",
    expired: "Session expired",
  };

  return (
    <span className={`connection ${status || ""}`} role="status">
      <span aria-hidden="true" className="dot" />
      {status ? labels[status] : "No live session"}
    </span>
  );
}

function workspaceForPath(pathname: string): WorkspaceMode {
  return pathname.startsWith("/student") ? "Student" : "Instructor";
}

export function Shell() {
  const { user } = useAuth();
  const { auth } = useRuntime();
  const navigate = useNavigate();
  const location = useLocation();

  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [openMenu, setOpenMenu] = useState<TopMenu>(null);
  const topbarMenusRef = useRef<HTMLDivElement | null>(null);

  const canUseInstructor = isInstructor(user);
  const canUseStudent = hasPlatformRole(user, "Student");

  const [workspace, setWorkspace] = useState<WorkspaceMode>(
    workspaceForPath(location.pathname),
  );

  useEffect(() => {
    const preferred = workspaceForPath(location.pathname);
    if (preferred !== workspace) {
      setWorkspace(preferred);
    }
  }, [location.pathname, workspace]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!openMenu) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (topbarMenusRef.current?.contains(target)) return;
      setOpenMenu(null);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [openMenu]);

  const navItems = useMemo(() => {
    if (workspace === "Student") {
      return [
        { to: "/student", icon: "⌂", label: "Home", end: true },
        { to: "/student/sessions", icon: "◇", label: "My Sessions" },
      ];
    }

    return [
      { to: "/instructor", icon: "⌂", label: "Home", end: true },
      { to: "/instructor/scenarios", icon: "◇", label: "Scenarios" },
      { to: "/instructor/sessions", icon: "▶", label: "Sessions" },
      { to: "/instructor/classrooms", icon: "▦", label: "Classrooms" },
    ];
  }, [workspace]);

  async function logout() {
    setSigningOut(true);
    try {
      await auth.logout();
      navigate("/auth", { replace: true });
    } catch {
      navigate("/auth", { replace: true, state: { logoutError: true } });
    } finally {
      setSigningOut(false);
    }
  }

  function switchWorkspace(next: WorkspaceMode) {
    if (next === workspace) return;
    if (next === "Instructor" && !canUseInstructor) return;
    if (next === "Student" && !canUseStudent) return;

    setWorkspace(next);
    setOpenMenu(null);
    navigate(next === "Instructor" ? "/instructor" : "/student");
  }

  const professorLabel = workspace === "Instructor" ? "Professor" : "Student";

  return (
    <ConnectionContext.Provider value={setConnection}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className={`app-shell ${openMenu ? "menu-open" : ""}`}>
        <header className="topbar">
          <Link className="brand" to="/">
            S<span aria-hidden="true">/</span>P{" "}
            <span className="brand-name">Simulation Platform</span>
          </Link>

          <div className="topbar-menus" ref={topbarMenusRef}>
            {canUseInstructor && canUseStudent ? (
              <div className="menu-dropdown">
                <button
                  type="button"
                  className="menu-trigger"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "workspace"}
                  onClick={() =>
                    setOpenMenu((current) =>
                      current === "workspace" ? null : "workspace",
                    )
                  }
                >
                  {workspace} Workspace
                </button>
                {openMenu === "workspace" && (
                  <div
                    className="menu-panel"
                    role="menu"
                    aria-label="Switch workspace"
                  >
                    <button
                      type="button"
                      onClick={() => switchWorkspace("Instructor")}
                    >
                      Instructor Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => switchWorkspace("Student")}
                    >
                      Student Workspace
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className="workspace-chip">{workspace} Workspace</span>
            )}

            <div className="menu-dropdown">
              <button
                type="button"
                className="menu-trigger"
                aria-haspopup="menu"
                aria-expanded={openMenu === "account"}
                onClick={() =>
                  setOpenMenu((current) =>
                    current === "account" ? null : "account",
                  )
                }
              >
                {professorLabel}
              </button>
              {openMenu === "account" && (
                <div
                  className="menu-panel"
                  role="menu"
                  aria-label="Account menu"
                >
                  <button type="button">Account</button>
                  {canUseInstructor && canUseStudent && (
                    <button
                      type="button"
                      onClick={() =>
                        switchWorkspace(
                          workspace === "Instructor" ? "Student" : "Instructor",
                        )
                      }
                    >
                      Switch workspace
                    </button>
                  )}
                  <button type="button" onClick={logout} disabled={signingOut}>
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {openMenu && (
          <button
            type="button"
            className="menu-backdrop"
            aria-label="Close open menu"
            onClick={() => setOpenMenu(null)}
          />
        )}

        <div className="workspace">
          <aside className="sidebar">
            <p className="eyebrow">{workspace} workspace</p>
            <nav aria-label="Primary navigation">
              {navItems.map((item) => (
                <NavLink end={item.end} to={item.to} key={item.to}>
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-foot">
              <ConnectionLabel status={connection} />
              <p>Teach through simulation.</p>
            </div>
          </aside>

          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>

        <footer className="mobile-connection">
          <ConnectionLabel status={connection} />
        </footer>
      </div>
    </ConnectionContext.Provider>
  );
}
