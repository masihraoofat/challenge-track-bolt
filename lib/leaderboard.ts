import {
  type CompetitionConfig,
  aggregateLogScore,
  computeStreakFromDates,
  resolveCompetitionScore,
  toScoreNumber,
} from '@/constants/competition';

export interface LeaderboardEntry {
  user_id: string;
  score: number;
  username: string;
  avatar_url: string | null;
  isCurrentUser: boolean;
  streak: number;
  todayValue: number | null;
  hasLogged: boolean;
}

interface ParticipantRow {
  user_id: string;
  score: unknown;
  users?:
    | { username?: string; avatar_url?: string | null }
    | { username?: string; avatar_url?: string | null }[]
    | null;
}

function resolveParticipantProfile(participant: ParticipantRow) {
  const users = participant.users;
  if (Array.isArray(users)) return users[0] ?? null;
  return users ?? null;
}

interface DailyLogRow {
  user_id: string;
  value: unknown;
  date_logged: string;
}

export function buildLeaderboardEntries(
  config: CompetitionConfig,
  participants: ParticipantRow[],
  allLogs: DailyLogRow[],
  currentUserId: string,
  today?: string,
): LeaderboardEntry[] {
  const todayValues: Record<string, number | null> = {};
  const logTotals: Record<string, number> = {};
  const logCounts: Record<string, number> = {};
  const logsByUser: Record<string, { value: unknown }[]> = {};
  const datesByUser: Record<string, Set<string>> = {};

  allLogs.forEach((log) => {
    if (!logsByUser[log.user_id]) {
      logsByUser[log.user_id] = [];
    }
    logsByUser[log.user_id].push(log);

    const val = toScoreNumber(log.value);
    if (today && log.date_logged === today) {
      todayValues[log.user_id] = val;
    }
    if (!datesByUser[log.user_id]) {
      datesByUser[log.user_id] = new Set();
    }
    datesByUser[log.user_id].add(log.date_logged);
  });

  for (const [userId, userLogs] of Object.entries(logsByUser)) {
    const aggregated = aggregateLogScore(config, userLogs);
    logTotals[userId] = aggregated.total;
    logCounts[userId] = aggregated.count;
  }

  const entries: LeaderboardEntry[] = participants.map((p) => {
    const profile = resolveParticipantProfile(p);
    const { score: participantScore, hasLogged } = resolveCompetitionScore(
      config,
      p.score,
      logTotals[p.user_id] ?? 0,
      logCounts[p.user_id] ?? 0,
    );
    const streak = hasLogged
      ? computeStreakFromDates(datesByUser[p.user_id] ?? new Set())
      : 0;

    return {
      user_id: p.user_id,
      score: participantScore,
      username: profile?.username || 'Unknown',
      avatar_url: profile?.avatar_url ?? null,
      isCurrentUser: p.user_id === currentUserId,
      streak,
      todayValue: todayValues[p.user_id] ?? null,
      hasLogged,
    };
  });

  if (config.sortOrder === 'asc') {
    entries.sort((a, b) => {
      if (!a.hasLogged && b.hasLogged) return 1;
      if (a.hasLogged && !b.hasLogged) return -1;
      return a.score - b.score;
    });
  } else {
    entries.sort((a, b) => {
      if (!a.hasLogged && b.hasLogged) return 1;
      if (a.hasLogged && !b.hasLogged) return -1;
      return b.score - a.score;
    });
  }

  return entries;
}
