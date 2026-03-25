import { useEffect, useState } from "react";

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
};

type UserSummary = {
  id: string;
  display_name: string;
  telegram_user_id: string;
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
  user_id: string;
  user_display_name: string;
  telegram_username: string | null;
  name: string;
  class_key: string;
  level: number;
  status: string;
  wins: number;
  losses: number;
  matches_played: number;
  created_at: string;
  last_match_at: string | null;
};

type MatchSummary = {
  id: string;
  dispute_id: string;
  status: string;
  winner_character_id: string | null;
  end_reason: string | null;
  rounds_completed: number;
  created_at: string;
  completed_at: string | null;
  challenger_character_name: string;
  target_character_name: string;
  winner_character_name: string | null;
};

type MatchParticipant = {
  id: string;
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
  match: MatchSummary & {
    winner_character_id: string | null;
  };
  participants: MatchParticipant[];
  events: MatchEvent[];
};

type AdminData = {
  dashboard: DashboardResponse | null;
  disputes: DisputeSummary[];
  users: UserSummary[];
  characters: CharacterSummary[];
  matches: MatchSummary[];
};

type ViewKey = "dashboard" | "disputes" | "matches" | "users" | "characters";

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "disputes", label: "Disputes" },
  { key: "matches", label: "Matches" },
  { key: "users", label: "Users" },
  { key: "characters", label: "Characters" },
];

function apiBase() {
  const explicitBase = import.meta.env.VITE_API_BASE_URL;

  if (explicitBase) {
    return explicitBase.replace(/\/$/, "");
  }

  if (window.location.port === "8080") {
    return "";
  }

  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  return "";
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed for ${path} (${response.status})`);
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

export function App() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [data, setData] = useState<AdminData>({
    dashboard: null,
    disputes: [],
    users: [],
    characters: [],
    matches: [],
  });
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    startLoading();

    Promise.all([
      fetchJson<DashboardResponse>("/api/dashboard"),
      fetchJson<{ disputes: DisputeSummary[] }>("/api/disputes"),
      fetchJson<{ matches: MatchSummary[] }>("/api/matches"),
      fetchJson<{ users: UserSummary[] }>("/api/users"),
      fetchJson<{ characters: CharacterSummary[] }>("/api/characters"),
    ])
      .then(([dashboard, disputes, matches, users, characters]) => {
        if (!isActive) {
          return;
        }

        setData({
          dashboard,
          disputes: disputes.disputes,
          matches: matches.matches,
          users: users.users,
          characters: characters.characters,
        });

        const firstMatchId = matches.matches[0]?.id ?? null;
        setSelectedMatchId(firstMatchId);
      })
      .catch((caughtError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Unknown admin loading error");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedMatchId) {
      setMatchDetail(null);
      return;
    }

    let isActive = true;
    setIsDetailLoading(true);

    fetchJson<MatchDetailResponse>(`/api/matches/${selectedMatchId}`)
      .then((response) => {
        if (isActive) {
          setMatchDetail(response);
        }
      })
      .catch(() => {
        if (isActive) {
          setMatchDetail(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedMatchId]);

  function startLoading() {
    setIsLoading(true);
    setError(null);
  }

  const stats = data.dashboard?.stats;

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
            <span>Environment</span>
            <strong>{data.dashboard?.system.environment ?? "loading"}</strong>
          </div>
          <div className="stat-chip">
            <span>Rules</span>
            <strong>{data.dashboard?.system.defaultRulesVersion ?? "loading"}</strong>
          </div>
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
