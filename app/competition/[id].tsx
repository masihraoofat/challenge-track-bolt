import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import {
  ArrowLeft,
  CircleCheck as CheckCircle2,
  Trophy,
  Flame,
  Calendar,
  Users,
  Copy,
  BookOpen,
  Activity,
  Smartphone,
  Sparkles,
} from 'lucide-react-native';
import {
  type CompetitionConfig,
  type CompetitionRow,
  CompetitionPreset,
  computeStreakFromDates,
  formatDuration,
  formatLeaderboardScore,
  formatUnitScore,
  getCheckInLabel,
  getCompetitionConfig,
  getLeaderboardTitle,
  getLogValueLabel,
  parseScreenTimeLog,
  resolveCompetitionScore,
  SCORING_MODES,
  toScoreNumber,
} from '@/constants/competition';

interface CompetitionDetail extends CompetitionRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  join_code: string;
}

interface LeaderboardEntry {
  user_id: string;
  score: number;
  username: string;
  isCurrentUser: boolean;
  streak: number;
  todayValue: number | null;
  hasLogged: boolean;
}

const PRESET_ICONS: Record<CompetitionPreset, React.ReactNode> = {
  reading: <BookOpen size={16} color={Colors.primary[500]} />,
  running: <Activity size={16} color={Colors.blue[500]} />,
  screen_time: <Smartphone size={16} color={Colors.teal[500]} />,
  custom: <Sparkles size={16} color={Colors.primary[500]} />,
};

function formatTodayValue(config: CompetitionConfig, value: number): string {
  if (config.logInputType === 'duration') return formatDuration(value);
  return formatUnitScore(value, config.unitLabel, config.logInputType);
}

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [logValue, setLogValue] = useState('');
  const [logHours, setLogHours] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [todayLoggedValue, setTodayLoggedValue] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;

    const { data: comp, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .single();

    if (compError || !comp) {
      showToast('Competition not found', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setCompetition(comp);

    const config = getCompetitionConfig(comp);

    const { data: participants, error: partError } = await supabase
      .from('participants')
      .select('user_id, score, users!inner(username)')
      .eq('competition_id', id);

    if (partError) {
      showToast('Failed to load leaderboard', 'error');
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: todayLog } = await supabase
      .from('daily_logs')
      .select('id, value')
      .eq('competition_id', id)
      .eq('user_id', user.id)
      .eq('date_logged', today)
      .eq('completed', true)
      .maybeSingle();

    const checkedIn = !!todayLog;
    setCheckedInToday(checkedIn);

    if (participants) {
      const todayValues: Record<string, number | null> = {};
      const logTotals: Record<string, number> = {};
      const logCounts: Record<string, number> = {};

      const { data: allLogs, error: logsError } = await supabase
        .from('daily_logs')
        .select('user_id, value, date_logged')
        .eq('competition_id', id)
        .eq('completed', true);

      if (logsError) {
        showToast('Failed to load daily logs', 'error');
      }

      const datesByUser: Record<string, Set<string>> = {};

      if (allLogs) {
        allLogs.forEach((log: any) => {
          logCounts[log.user_id] = (logCounts[log.user_id] || 0) + 1;
          const val = toScoreNumber(log.value);
          if (config.scoringMode !== 'daily') {
            logTotals[log.user_id] = (logTotals[log.user_id] || 0) + val;
          }
          if (log.date_logged === today) {
            todayValues[log.user_id] = val;
          }
          if (!datesByUser[log.user_id]) {
            datesByUser[log.user_id] = new Set();
          }
          datesByUser[log.user_id].add(log.date_logged);
        });
      }

      const entries: LeaderboardEntry[] = participants.map((p: any) => {
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
          username: p.users?.username || 'Unknown',
          isCurrentUser: p.user_id === user.id,
          streak,
          todayValue: todayValues[p.user_id] ?? null,
          hasLogged,
        };
      });

      // Sort based on competition type. For ascending (lowest wins) competitions
      // we push participants who haven't logged anything yet to the bottom so a
      // 0-score doesn't masquerade as the winner.
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

      setLeaderboard(entries);

      if (config.logInputType !== 'checkin') {
        const todayVal = todayValues[user.id];
        setTodayLoggedValue(
          todayVal != null
            ? todayVal
            : checkedIn && todayLog?.value != null
              ? toScoreNumber(todayLog.value)
              : null
        );
      } else {
        setTodayLoggedValue(null);
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCheckIn = async () => {
    if (!user || !id || checkedInToday) return;
    setCheckingIn(true);

    const config = getCompetitionConfig(competition);
    const today = new Date().toISOString().split('T')[0];

    let valueToLog: number | null = null;
    let scoreAmount: number = 1;

    if (config.logInputType === 'number') {
      const amount = parseFloat(logValue);
      if (!logValue || isNaN(amount) || amount < 0) {
        showToast(`Please enter a valid number of ${config.unitLabel || 'units'}`, 'error');
        setCheckingIn(false);
        return;
      }
      valueToLog = amount;
      scoreAmount = amount;
    } else if (config.logInputType === 'duration') {
      const parsed = parseScreenTimeLog(logHours, logMinutes);
      if ('error' in parsed) {
        showToast(parsed.error, 'error');
        setCheckingIn(false);
        return;
      }
      valueToLog = parsed.decimalHours;
      scoreAmount = parsed.decimalHours;
    }

    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('id, completed')
      .eq('competition_id', id)
      .eq('user_id', user.id)
      .eq('date_logged', today)
      .maybeSingle();

    if (existingLog?.completed) {
      setCheckedInToday(true);
      setCheckingIn(false);
      showToast('Already logged today', 'info');
      return;
    }

    if (existingLog) {
      const { error } = await supabase
        .from('daily_logs')
        .update({ completed: true, value: valueToLog })
        .eq('id', existingLog.id);

      if (error) {
        showToast('Check-in failed', 'error');
        setCheckingIn(false);
        return;
      }
    } else {
      const { error } = await supabase.from('daily_logs').insert({
        competition_id: id,
        user_id: user.id,
        date_logged: today,
        completed: true,
        value: valueToLog,
      });

      if (error) {
        showToast('Check-in failed', 'error');
        setCheckingIn(false);
        return;
      }
    }

    const { error: updateError } = await supabase.rpc('increment_score', {
      comp_id: id,
      uid: user.id,
      amount: scoreAmount,
    });

    if (updateError) {
      showToast('Score update failed', 'error');
      setCheckingIn(false);
      return;
    }

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'daily_goal_met',
      event_data: { competition_id: id, value: valueToLog },
    });

    setCheckedInToday(true);
    setTodayLoggedValue(valueToLog);
    setCheckingIn(false);
    setLogValue('');
    setLogHours('');
    setLogMinutes('');
    showToast('Progress logged!', 'success');
    fetchData();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysRemaining = () => {
    if (!competition) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(competition.end_date + 'T00:00:00');
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isCompetitionActive = () => {
    if (!competition) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(competition.start_date + 'T00:00:00');
    const end = new Date(competition.end_date + 'T00:00:00');
    return today >= start && today <= end;
  };

  const handleCopyCode = async () => {
    if (!competition?.join_code) return;
    try {
      await Clipboard.setStringAsync(competition.join_code);
      showToast('Join code copied!', 'success');
    } catch {
      showToast('Could not copy code', 'error');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const config = getCompetitionConfig(competition);
  const colorSet = config.colorSet;
  const daysLeft = getDaysRemaining();
  const active = isCompetitionActive();
  const maxScore = Math.max(
    ...leaderboard.filter((e) => e.hasLogged).map((e) => e.score),
    1
  );

  const getScoreDisplay = (entry: LeaderboardEntry) =>
    formatLeaderboardScore(config, entry.score, entry.hasLogged);

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank = index + 1;
    const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : null;
    const hasFlame = item.streak > 1;
    // For "lowest wins" competitions (screen_time) invert the bar so the
    // leader visually has the fullest fill. Participants with no logs yet
    // (score === 0) have an empty bar in either direction.
    let barWidth = 0;
    if (item.hasLogged && maxScore > 0) {
      if (config.sortOrder === 'asc') {
        barWidth = ((maxScore - item.score) / maxScore) * 100;
      } else {
        barWidth = (item.score / maxScore) * 100;
      }
    }

    return (
      <View style={[styles.leaderboardRow, item.isCurrentUser && styles.currentUserRow]}>
        <View style={styles.rankContainer}>
          {medalColor ? (
            <Trophy size={20} color={medalColor} fill={medalColor} />
          ) : (
            <Text style={styles.rankText}>{rank}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, item.isCurrentUser && styles.currentUsername]}>
              {item.username}
              {item.isCurrentUser && ' (You)'}
            </Text>
            {hasFlame && (
              <View style={styles.flameBadge}>
                <Flame size={12} color={Colors.warm[500]} />
                <Text style={styles.flameText}>{item.streak}</Text>
              </View>
            )}
          </View>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${Math.min(barWidth, 100)}%`, backgroundColor: colorSet[400] }]} />
          </View>
        </View>
        <View style={styles.scoreContainer}>
          {PRESET_ICONS[config.preset]}
          <View style={styles.scoreTextGroup}>
            <Text style={[styles.scoreText, { color: colorSet[600] }]}>{getScoreDisplay(item)}</Text>
            {config.logInputType !== 'checkin' && item.todayValue != null && (
              <Text style={styles.todayScoreText}>
                Today: {formatTodayValue(config, item.todayValue)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const checkInLabel = getCheckInLabel(config);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          {PRESET_ICONS[config.preset]}
          <Text style={styles.headerTitle} numberOfLines={1}>{competition?.title}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={leaderboard}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item) => item.user_id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.infoSection}>
            <View style={styles.competitionInfo}>
              <View style={[styles.infoChip, { backgroundColor: colorSet[50] }]}>
                {PRESET_ICONS[config.preset]}
                <Text style={[styles.infoChipText, { color: colorSet[700] }]}>{config.label}</Text>
              </View>
              <View style={[styles.infoChip, { backgroundColor: colorSet[50] }]}>
                <Trophy size={14} color={colorSet[600]} />
                <Text style={[styles.infoChipText, { color: colorSet[700] }]}>
                  {SCORING_MODES[config.scoringMode].label}
                </Text>
              </View>
              <View style={[styles.infoChip, { backgroundColor: colorSet[50] }]}>
                <Calendar size={14} color={colorSet[600]} />
                <Text style={[styles.infoChipText, { color: colorSet[700] }]}>
                  {competition
                    ? `${formatDate(competition.start_date)} - ${formatDate(competition.end_date)}`
                    : ''}
                </Text>
              </View>
              <View style={[styles.infoChip, { backgroundColor: colorSet[50] }]}>
                <Users size={14} color={colorSet[600]} />
                <Text style={[styles.infoChipText, { color: colorSet[700] }]}>{leaderboard.length} joined</Text>
              </View>
              {active && (
                <View style={[styles.infoChip, { backgroundColor: Colors.success[100] }]}>
                  <Flame size={14} color={Colors.success[600]} />
                  <Text style={[styles.infoChipText, { color: Colors.success[600] }]}>
                    {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                  </Text>
                </View>
              )}
            </View>

            {config.description ? (
              <Text style={styles.descriptionText}>{config.description}</Text>
            ) : null}

            {competition?.join_code && (
              <View style={styles.joinCodeSection}>
                <View style={[styles.joinCodeCard, { borderColor: colorSet[200] }]}>
                  <Text style={styles.joinCodeLabel}>INVITE CODE</Text>
                  <Text style={[styles.joinCodeValue, { color: colorSet[600] }]}>{competition.join_code}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyCodeButton, { backgroundColor: colorSet[100] }]}
                  onPress={handleCopyCode}
                  accessibilityRole="button"
                  accessibilityLabel="Copy join code"
                >
                  <Copy size={16} color={colorSet[600]} />
                  <Text style={[styles.copyCodeText, { color: colorSet[600] }]}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            {active && (
              <View style={styles.checkInSection}>
                {config.logInputType === 'number' && !checkedInToday && (
                  <View style={styles.valueInputGroup}>
                    <Text style={styles.valueLabel}>{getLogValueLabel(config)}</Text>
                    <TextInput
                      style={styles.valueInput}
                      value={logValue}
                      onChangeText={setLogValue}
                      placeholder="e.g. 5"
                      placeholderTextColor={Colors.neutral[400]}
                      keyboardType="decimal-pad"
                      maxLength={8}
                    />
                    {config.unitLabel ? (
                      <Text style={styles.valueUnit}>{config.unitLabel}</Text>
                    ) : null}
                  </View>
                )}
                {config.logInputType === 'duration' && !checkedInToday && (
                  <View style={styles.valueInputGroup}>
                    <Text style={styles.valueLabel}>{getLogValueLabel(config)}</Text>
                    <View style={styles.durationInputRow}>
                      <View style={styles.durationField}>
                        <TextInput
                          style={styles.durationInput}
                          value={logHours}
                          onChangeText={setLogHours}
                          placeholder="0"
                          placeholderTextColor={Colors.neutral[400]}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                        <Text style={styles.durationUnit}>hr</Text>
                      </View>
                      <View style={styles.durationField}>
                        <TextInput
                          style={styles.durationInput}
                          value={logMinutes}
                          onChangeText={setLogMinutes}
                          placeholder="0"
                          placeholderTextColor={Colors.neutral[400]}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                        <Text style={styles.durationUnit}>min</Text>
                      </View>
                    </View>
                  </View>
                )}
                {checkedInToday && config.logInputType !== 'checkin' && todayLoggedValue !== null && (
                  <View style={[styles.loggedTodayCard, { backgroundColor: colorSet[50] }]}>
                    <Text style={styles.loggedTodayLabel}>Logged today</Text>
                    <Text style={[styles.loggedTodayValue, { color: colorSet[700] }]}>
                      {formatTodayValue(config, todayLoggedValue)}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.checkInButton,
                    { backgroundColor: colorSet[500] },
                    checkedInToday && { backgroundColor: Colors.success[500] },
                  ]}
                  onPress={handleCheckIn}
                  disabled={checkedInToday || checkingIn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={checkedInToday ? 'Logged today' : checkInLabel}
                >
                  {checkingIn ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : checkedInToday ? (
                    <>
                      <CheckCircle2 size={22} color="#FFFFFF" />
                      <Text style={styles.checkedInText}>Logged today!</Text>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={22} color="#FFFFFF" />
                      <Text style={styles.checkInText}>{checkInLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.leaderboardHeader}>
              <Trophy size={20} color={Colors.warm[500]} />
              <Text style={styles.leaderboardTitle}>{getLeaderboardTitle(config)}</Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colorSet[500]} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  competitionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  infoChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  joinCodeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  joinCodeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  joinCodeLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.neutral[400],
    letterSpacing: 1,
  },
  joinCodeValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  copyCodeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  checkInSection: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  valueInputGroup: {
    gap: Spacing.xs,
  },
  valueLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  valueInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.lg,
    color: Colors.text,
    fontWeight: '600',
  },
  valueUnit: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
  },
  durationInputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  durationField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  durationInput: {
    flex: 1,
    fontSize: FontSizes.lg,
    color: Colors.text,
    fontWeight: '600',
    padding: 0,
  },
  durationUnit: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.neutral[500],
  },
  loggedTodayCard: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  loggedTodayLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loggedTodayValue: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  checkedInText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  checkInText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  leaderboardTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
  },
  currentUserRow: {
    borderColor: Colors.primary[200],
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.neutral[400],
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  username: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.text,
  },
  currentUsername: {
    fontWeight: '700',
    color: Colors.primary[700],
  },
  flameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.warm[100],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  flameText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.warm[500],
  },
  scoreBarBg: {
    height: 4,
    backgroundColor: Colors.neutral[100],
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  scoreTextGroup: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scoreText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  todayScoreText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: Colors.neutral[500],
  },
});
