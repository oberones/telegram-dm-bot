import { FormEvent, useEffect, useState } from "react";

type SessionResponse = {
  authenticated: boolean;
  adminUser?: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
};

type DashboardResponse = {
  system: {
    environment: string;
    defaultRulesVersion: string;
  };
  stats: {
    pendingDisputes: number;
    runningMatches: number;
    failedMatches: number;
  };
};

type DisputeSummary = {
  id: string;
  status: string;
  reason: string;
  created_at: string;
  challenger_display_name: string;
  target_display_name: string;
  challenger_character_name: string;
  target_character_name: string;
  recovery_hint: string;
};

type UserSummary = {
  id: string;
  display_name: string;
  telegram_username: string | null;
  status: string;
  last_seen_at: string | null;
  character_name: string | null;
  class_key: string | null;
  matches_played: number | null;
  wins: number | null;
  losses: number | null;
};

type CharacterSummary = {
  id: string;
  user_display_name: string;
  name: string;
  class_key: string;
  level: number;
  status: string;
  wins: number;
  losses: number;
  matches_played: number;
  last_match_at: string | null;
};

type PartyMemberSummary = {
  id: string;
  user_display_name: string;
  telegram_username: string | null;
  character_name: string;
  class_key: string;
  status: string;
};

type PartySummary = {
  id: string;
  leader_display_name: string;
  status: string;
  party_name: string | null;
  active_run_id: string | null;
  created_at: string;
  members: PartyMemberSummary[];
};

type RunSummary = {
  id: string;
  party_id: string;
  status: string;
  seed: string;
  generation_version: string;
  theme_key: string | null;
  floor_count: number;
  difficulty_tier: number;
  started_at: string | null;
};

type MatchSummary = {
  id: string;
  dispute_id: string;
  status: string;
  winner_character_name: string | null;
  end_reason: string | null;
  rounds_completed: number;
  created_at: string;
  completed_at: string | null;
  challenger_character_name: string;
  target_character_name: string;
  error_summary?: string | null;
  admin_finalization_reason?: string | null;
  recovery_hint: string;
};

type MatchParticipant = {
  id: string;
  character_id: string;
  slot: number;
  is_winner: boolean;
  character_name: string;
  user_display_name: string;
};

type MatchEvent = {
  id: string;
  round_number: number;
  sequence_number: number;
  event_type: string;
  public_text: string | null;
};

type MatchDetailResponse = {
  match: MatchSummary;
  participants: MatchParticipant[];
  events: MatchEvent[];
  recovery_hint: string;
};

type AuditLog = {
  id: string;
  actor_type: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
  admin_display_name: string | null;
  user_display_name: string | null;
};

type AdminData = {
  dashboard: DashboardResponse | null;
  disputes: DisputeSummary[];
  users: UserSummary[];
  characters: CharacterSummary[];
  parties: PartySummary[];
  runs: RunSummary[];
  matches: MatchSummary[];
  auditLogs: AuditLog[];
};

type ViewKey = "dashboard" | "parties" | "disputes" | "matches" | "users" | "characters" | "audit" | "recovery";

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "parties", label: "Parties" },
  { key: "disputes", label: "Disputes" },
  { key: "matches", label: "Matches" },
  { key: "users", label: "Users" },
  { key: "characters", label: "Characters" },
  { key: "audit", label: "Audit Log" },
  { key: "recovery", label: "Recovery" },
];

function apiBase() {
  const explicitBase = import.meta.env.VITE_API_BASE_URL;

  if (explicitBase) {
    return explicitBase.replace(/\/$/, "");
  }

  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  return "";
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorBody.error ?? `Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function emptyAdminData(): AdminData {
  return {
    dashboard: null,
    disputes: [],
    users: [],
    characters: [],
    parties: [],
    runs: [],
    matches: [],
    auditLogs: [],
  };
}

function canModerate(role: string | undefined) {
  return role === "super_admin" || role === "operator";
}

export function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetailResponse | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function refreshAdminData() {
    setIsLoading(true);
    setError(null);

    try {
      const [dashboard, disputes, matches, users, characters, parties, runs, auditLogs] = await Promise.all([
        fetchJson<DashboardResponse>("/api/dashboard"),
        fetchJson<{ disputes: DisputeSummary[] }>("/api/disputes"),
        fetchJson<{ matches: MatchSummary[] }>("/api/matches"),
        fetchJson<{ users: UserSummary[] }>("/api/users"),
        fetchJson<{ characters: CharacterSummary[] }>("/api/characters"),
        fetchJson<{ parties: PartySummary[] }>("/api/parties"),
        fetchJson<{ runs: RunSummary[] }>("/api/runs"),
        fetchJson<{ auditLogs: AuditLog[] }>("/api/audit-logs"),
      ]);

      setData({
        dashboard,
        disputes: disputes.disputes,
        matches: matches.matches,
        users: users.users,
        characters: characters.characters,
        parties: parties.parties,
        runs: runs.runs,
        auditLogs: auditLogs.auditLogs,
      });
      setSelectedMatchId((current) => current ?? matches.matches[0]?.id ?? null);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Unknown admin loading error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchJson<SessionResponse>("/api/session")
      .then((response) => {
        setSession(response);
      })
      .catch(() => {
        setSession({ authenticated: false });
      })
      .finally(() => {
        setIsSessionLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!session?.authenticated) {
      setData(emptyAdminData());
      setSelectedMatchId(null);
      setMatchDetail(null);
      return;
    }

    void refreshAdminData();
  }, [session]);

  useEffect(() => {
    if (!session?.authenticated || !selectedMatchId) {
      setMatchDetail(null);
      return;
    }

    setIsDetailLoading(true);

    fetchJson<MatchDetailResponse>(`/api/matches/${selectedMatchId}`)
      .then((response) => {
        setMatchDetail(response);
      })
      .catch(() => {
        setMatchDetail(null);
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  }, [selectedMatchId, session]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const nextSession = await fetchJson<SessionResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      setSession(nextSession);
      setLoginPassword("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await fetchJson("/api/logout", { method: "POST" }).catch(() => undefined);
    setSession({ authenticated: false });
    setData(emptyAdminData());
    setSelectedMatchId(null);
    setMatchDetail(null);
  }

  async function updateUserStatus(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    const reason = nextStatus === "suspended"
      ? window.prompt("Why are you suspending this user?")?.trim()
      : window.prompt("Optional reactivation note")?.trim();

    if (nextStatus === "suspended" && !reason) {
      setError("A suspension reason is required.");
      return;
    }

    try {
      await fetchJson(`/api/users/${userId}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: nextStatus,
          reason,
        }),
      });
      await refreshAdminData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "User status update failed");
    }
  }

  async function updateCharacterStatus(characterId: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "frozen" : "active";
    const reason = nextStatus === "frozen"
      ? window.prompt("Why are you freezing this character?")?.trim()
      : window.prompt("Optional unfreeze note")?.trim();

    if (nextStatus === "frozen" && !reason) {
      setError("A freeze reason is required.");
      return;
    }

    try {
      await fetchJson(`/api/characters/${characterId}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: nextStatus,
          reason,
        }),
      });
      await refreshAdminData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Character status update failed");
    }
  }

  async function cancelPendingDispute(disputeId: string) {
    const reason = window.prompt("Why are you cancelling this pending dispute?")?.trim();

    if (!reason) {
      setError("A cancellation reason is required.");
      return;
    }

    try {
      await fetchJson(`/api/disputes/${disputeId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await refreshAdminData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Dispute cancellation failed");
    }
  }

  async function cancelFlaggedMatch(matchId: string) {
    const reason = window.prompt("Why are you cancelling this match?")?.trim();

    if (!reason) {
      setError("A match cancellation reason is required.");
      return;
    }

    try {
      await fetchJson(`/api/matches/${matchId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await refreshAdminData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Match cancellation failed");
    }
  }

  async function finalizeFlaggedMatch(matchId: string) {
    try {
      const detail = await fetchJson<MatchDetailResponse>(`/api/matches/${matchId}`);
      const participantPrompt = detail.participants
        .map((participant) => `${participant.slot}: ${participant.character_name}`)
        .join("\n");
      const selectedSlot = window.prompt(
        `Choose the winning participant slot for administrative finalization:\n${participantPrompt}`,
      )?.trim();
      const reason = window.prompt("Why are you finalizing this match?")?.trim();

      if (!selectedSlot || !reason) {
        setError("A winner selection and finalization reason are required.");
        return;
      }

      const winner = detail.participants.find((participant) => String(participant.slot) === selectedSlot);

      if (!winner) {
        setError("That participant slot is not valid for this match.");
        return;
      }

      await fetchJson(`/api/matches/${matchId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          winnerCharacterId: winner.character_id,
          reason,
        }),
      });
      await refreshAdminData();
      setSelectedMatchId(matchId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Match finalization failed");
    }
  }

  if (isSessionLoading) {
    return <main className="shell"><section className="panel">Loading admin session...</section></main>;
  }

  if (!session?.authenticated) {
    return (
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Dungeon Master Bot</p>
            <h1>Admin sign-in</h1>
            <p className="lede">
              This control room is protected. Sign in with the bootstrap admin credentials from your environment.
            </p>
          </div>
        </section>

        {error ? <section className="error-banner">{error}</section> : null}

        <section className="panel auth-panel">
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label>
              <span>Email</span>
              <input
                autoComplete="username"
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
                value={loginEmail}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                value={loginPassword}
              />
            </label>
            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const stats = data.dashboard?.stats;
  const moderationEnabled = canModerate(session.adminUser?.role);

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Dungeon Master Bot</p>
          <h1>Admin control room</h1>
          <p className="lede">
            Read-only operational visibility for the arbitration system: users, characters,
            disputes, matches, and combat logs.
          </p>
        </div>

        <div className="hero-meta">
          <div className="stat-chip">
            <span>Signed in as</span>
            <strong>{session.adminUser?.displayName}</strong>
          </div>
          <div className="stat-chip">
            <span>Role</span>
            <strong>{capitalize(session.adminUser?.role ?? "unknown")}</strong>
          </div>
          <button className="secondary-button" onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      </section>

      {error ? <section className="error-banner">{error}</section> : null}

      <nav className="nav-row" aria-label="Admin views">
        {navItems.map((item) => (
          <button
            className={item.key === view ? "nav-pill active" : "nav-pill"}
            key={item.key}
            onClick={() => setView(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="metrics">
        <article className="metric-card">
          <span>Pending disputes</span>
          <strong>{stats?.pendingDisputes ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Running matches</span>
          <strong>{stats?.runningMatches ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Failed matches</span>
          <strong>{stats?.failedMatches ?? 0}</strong>
        </article>
      </section>

      {isLoading ? <section className="panel">Loading admin data...</section> : null}

      {!isLoading && view === "dashboard" ? (
        <section className="dashboard-grid">
          <article className="panel">
            <header className="panel-header">
              <h2>Recent disputes</h2>
              <span>{data.disputes.length}</span>
            </header>
            <div className="stack-list">
              {data.disputes.slice(0, 6).map((dispute) => (
                <div className="list-row" key={dispute.id}>
                  <strong>
                    {dispute.challenger_character_name} vs {dispute.target_character_name}
                  </strong>
                  <span>{capitalize(dispute.status)}</span>
                  <p>{dispute.reason}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <h2>Active parties</h2>
              <span>{data.parties.length}</span>
            </header>
            <div className="stack-list">
              {data.parties.slice(0, 6).map((party) => (
                <div className="list-row" key={party.id}>
                  <strong>{party.party_name ?? `${party.leader_display_name}'s party`}</strong>
                  <span>{capitalize(party.status)}</span>
                  <p>{party.members.length} members | Active run: {party.active_run_id ?? "none"}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <h2>Recent matches</h2>
              <span>{data.matches.length}</span>
            </header>
            <div className="stack-list">
              {data.matches.slice(0, 6).map((match) => (
                <div className="list-row" key={match.id}>
                  <strong>
                    {match.challenger_character_name} vs {match.target_character_name}
                  </strong>
                  <span>{capitalize(match.status)}</span>
                  <p>
                    Winner: {match.winner_character_name ?? "pending"} | {capitalize(match.end_reason ?? "unknown")}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {!isLoading && view === "disputes" ? (
        <section className="panel">
          <header className="panel-header">
            <h2>Disputes</h2>
            <span>{data.disputes.length}</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Matchup</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.disputes.map((dispute) => (
                  <tr key={dispute.id}>
                    <td>{formatDate(dispute.created_at)}</td>
                    <td>
                      {dispute.challenger_display_name} ({dispute.challenger_character_name}) vs{" "}
                      {dispute.target_display_name} ({dispute.target_character_name})
                    </td>
                    <td>{capitalize(dispute.status)}</td>
                    <td>{dispute.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && view === "parties" ? (
        <section className="dashboard-grid">
          <article className="panel">
            <header className="panel-header">
              <h2>Active parties</h2>
              <span>{data.parties.length}</span>
            </header>
            <div className="stack-list">
              {data.parties.map((party) => (
                <div className="list-row" key={party.id}>
                  <strong>{party.party_name ?? `${party.leader_display_name}'s party`}</strong>
                  <span>{capitalize(party.status)}</span>
                  <p>Leader: {party.leader_display_name}</p>
                  <p>Run: {party.active_run_id ?? "Not started"}</p>
                  <p>
                    Members:{" "}
                    {party.members.map((member) => {
                      const handle = member.telegram_username ? `@${member.telegram_username}` : member.user_display_name;
                      return `${member.character_name} (${member.class_key}, ${member.status}, ${handle})`;
                    }).join(" | ")}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <h2>Active runs</h2>
              <span>{data.runs.length}</span>
            </header>
            <div className="stack-list">
              {data.runs.map((run) => (
                <div className="list-row" key={run.id}>
                  <strong>{run.id}</strong>
                  <span>{capitalize(run.status)}</span>
                  <p>Party: {run.party_id}</p>
                  <p>Theme: {run.theme_key ?? "unknown"} | Floors: {run.floor_count} | Tier: {run.difficulty_tier}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {!isLoading && view === "recovery" ? (
        <section className="dashboard-grid">
          <article className="panel">
            <header className="panel-header">
              <h2>Pending disputes</h2>
              <span>{data.disputes.filter((dispute) => dispute.status === "pending").length}</span>
            </header>
            <div className="stack-list">
              {data.disputes.filter((dispute) => dispute.status === "pending").map((dispute) => (
                <div className="list-row" key={dispute.id}>
                  <strong>
                    {dispute.challenger_character_name} vs {dispute.target_character_name}
                  </strong>
                  <span>{formatDate(dispute.created_at)}</span>
                  <p>{dispute.reason}</p>
                  <p className="muted-copy">{dispute.recovery_hint}</p>
                  <div className="inline-actions">
                    <button
                      className="table-action"
                      disabled={!moderationEnabled}
                      onClick={() => void cancelPendingDispute(dispute.id)}
                      type="button"
                    >
                      Cancel dispute
                    </button>
                  </div>
                </div>
              ))}
              {data.disputes.every((dispute) => dispute.status !== "pending") ? (
                <div className="list-row">
                  <strong>No pending disputes need recovery action right now.</strong>
                </div>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <header className="panel-header">
              <h2>Flagged matches</h2>
              <span>{data.matches.filter((match) => match.status === "running" || match.status === "error").length}</span>
            </header>
            <div className="stack-list">
              {data.matches
                .filter((match) => match.status === "running" || match.status === "error")
                .map((match) => (
                  <div className="list-row" key={match.id}>
                    <strong>
                      {match.challenger_character_name} vs {match.target_character_name}
                    </strong>
                    <span>{capitalize(match.status)}</span>
                    <p>
                      Winner: {match.winner_character_name ?? "pending"} | {capitalize(match.end_reason ?? "unknown")}
                    </p>
                    <p className="muted-copy">{match.recovery_hint}</p>
                    <div className="inline-actions">
                      <button
                        className="table-action"
                        disabled={!moderationEnabled}
                        onClick={() => void finalizeFlaggedMatch(match.id)}
                        type="button"
                      >
                        Finalize winner
                      </button>
                      <button
                        className="table-action"
                        disabled={!moderationEnabled}
                        onClick={() => void cancelFlaggedMatch(match.id)}
                        type="button"
                      >
                        Cancel match
                      </button>
                    </div>
                  </div>
                ))}
              {data.matches.every((match) => match.status !== "running" && match.status !== "error") ? (
                <div className="list-row">
                  <strong>No running or errored matches are currently flagged.</strong>
                </div>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {!isLoading && view === "users" ? (
        <section className="panel">
          <header className="panel-header">
            <h2>Users</h2>
            <span>{data.users.length}</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Character</th>
                  <th>Record</th>
                  <th>Last seen</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.display_name}</td>
                    <td>{user.telegram_username ? `@${user.telegram_username}` : "none"}</td>
                    <td>{capitalize(user.status)}</td>
                    <td>{user.character_name ? `${user.character_name} (${user.class_key})` : "none"}</td>
                    <td>{user.matches_played ? `${user.wins}-${user.losses}` : "0-0"}</td>
                    <td>{formatDate(user.last_seen_at)}</td>
                    <td>
                      <button
                        className="table-action"
                        disabled={!moderationEnabled}
                        onClick={() => void updateUserStatus(user.id, user.status)}
                        type="button"
                      >
                        {user.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && view === "characters" ? (
        <section className="panel">
          <header className="panel-header">
            <h2>Characters</h2>
            <span>{data.characters.length}</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Record</th>
                  <th>Last match</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.characters.map((character) => (
                  <tr key={character.id}>
                    <td>{character.name}</td>
                    <td>{character.user_display_name}</td>
                    <td>
                      {capitalize(character.class_key)} Lv{character.level}
                    </td>
                    <td>{capitalize(character.status)}</td>
                    <td>
                      {character.wins}-{character.losses} ({character.matches_played})
                    </td>
                    <td>{formatDate(character.last_match_at)}</td>
                    <td>
                      <button
                        className="table-action"
                        disabled={!moderationEnabled}
                        onClick={() => void updateCharacterStatus(character.id, character.status)}
                        type="button"
                      >
                        {character.status === "active" ? "Freeze" : "Unfreeze"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && view === "audit" ? (
        <section className="panel">
          <header className="panel-header">
            <h2>Audit log</h2>
            <span>{data.auditLogs.length}</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{entry.admin_display_name ?? entry.user_display_name ?? entry.actor_type}</td>
                    <td>{capitalize(entry.action)}</td>
                    <td>
                      {entry.target_type}
                      {entry.target_id ? ` (${entry.target_id.slice(0, 8)})` : ""}
                    </td>
                    <td>{entry.reason ?? "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isLoading && view === "matches" ? (
        <section className="matches-layout">
          <article className="panel">
            <header className="panel-header">
              <h2>Matches</h2>
              <span>{data.matches.length}</span>
            </header>
            <div className="stack-list selectable-list">
              {data.matches.map((match) => (
                <button
                  className={match.id === selectedMatchId ? "list-row selected" : "list-row"}
                  key={match.id}
                  onClick={() => setSelectedMatchId(match.id)}
                  type="button"
                >
                  <strong>
                    {match.challenger_character_name} vs {match.target_character_name}
                  </strong>
                  <span>{capitalize(match.status)}</span>
                  <p>
                    Winner: {match.winner_character_name ?? "pending"} | {formatDate(match.completed_at ?? match.created_at)}
                  </p>
                </button>
              ))}
            </div>
          </article>

          <article className="panel detail-panel">
            <header className="panel-header">
              <h2>Match detail</h2>
              <span>{selectedMatchId ? selectedMatchId.slice(0, 8) : "none"}</span>
            </header>

            {isDetailLoading ? <p>Loading match detail...</p> : null}

            {!isDetailLoading && matchDetail ? (
              <>
                <div className="detail-grid">
                  <div className="detail-card">
                    <span>Status</span>
                    <strong>{capitalize(matchDetail.match.status)}</strong>
                  </div>
                  <div className="detail-card">
                    <span>Winner</span>
                    <strong>{matchDetail.match.winner_character_name ?? "pending"}</strong>
                  </div>
                  <div className="detail-card">
                    <span>End reason</span>
                    <strong>{capitalize(matchDetail.match.end_reason ?? "unknown")}</strong>
                  </div>
                  <div className="detail-card">
                    <span>Rounds</span>
                    <strong>{matchDetail.match.rounds_completed}</strong>
                  </div>
                </div>

                <section className="subsection">
                  <h3>Recovery signal</h3>
                  <p className="muted-copy">{matchDetail.recovery_hint}</p>
                  {matchDetail.match.error_summary ? (
                    <p className="muted-copy">Stored error: {matchDetail.match.error_summary}</p>
                  ) : null}
                  {matchDetail.match.admin_finalization_reason ? (
                    <p className="muted-copy">
                      Admin finalization note: {matchDetail.match.admin_finalization_reason}
                    </p>
                  ) : null}
                </section>

                <section className="subsection">
                  <h3>Participants</h3>
                  <div className="stack-list">
                    {matchDetail.participants.map((participant) => (
                      <div className="list-row" key={participant.id}>
                        <strong>
                          Slot {participant.slot}: {participant.character_name}
                        </strong>
                        <span>{participant.is_winner ? "Winner" : "Defeated"}</span>
                        <p>{participant.user_display_name}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="subsection">
                  <h3>Event log</h3>
                  <div className="event-log">
                    {matchDetail.events.map((event) => (
                      <div className="event-row" key={event.id}>
                        <span>#{event.sequence_number}</span>
                        <div>
                          <strong>{event.public_text ?? capitalize(event.event_type)}</strong>
                          <p>Round {event.round_number}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </article>
        </section>
      ) : null}
    </main>
  );
}
