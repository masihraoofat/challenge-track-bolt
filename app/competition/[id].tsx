import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { CompetitionType, getCompetitionTypeConfig } from '@/constants/competition';

interface LeaderboardEntry {
  user_id: string;
  score: number;
  username: string;
  isCurrentUser: boolean;
  streak: number;
  todayValue: number | null;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  reading: <BookOpen size={16} color={Colors.primary[500]} />,
  running: <Activity size={16} color={Colors.blue[500]} />,
  screen_time: <Smartphone size={16} color={Colors.teal[500]} />,
};

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [competition, setCompetition] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [logValue, setLogValue] = useState('');

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

    const compType = (comp.competition_type || 'reading') as CompetitionType;
    const typeConfig = getCompetitionTypeConfig(compType);

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

      // Get today's values for all participants
      if (compType !== 'reading') {
        const { data: todayLogs } = await supabase
          .from('daily_logs')
          .select('user_id, value')
          .eq('competition_id', id)
          .eq('date_logged', today)
          .eq('completed', true);
        if (todayLogs) {
          todayLogs.forEach((log: any) => {
            todayValues[log.user_id] = log.value ?? null;
          });
        }
      }

      const entries: LeaderboardEntry[] = await Promise.all(
        participants.map(async (p: any) => {
          let streak = 0;
          if (p.score > 0) {
            const { data: recentLogs } = await supabase
              .from('daily_logs')
              .select('date_logged')
              .eq('competition_id', id)
              .eq('user_id', p.user_id)
              .eq('completed', true)
              .order('date_logged', { ascending: false })
              .limit(30);

            if (recentLogs && recentLogs.length > 0) {
              const todayDate = new Date();
              todayDate.setHours(0, 0, 0, 0);
              const checkDate = new Date(todayDate);

              for (let i = 0; i < 30; i++) {
                const dateStr = checkDate.toISOString().split('T')[0];
                const found = recentLogs.some((log: any) => log.date_logged === dateStr);
                if (found) {
                  streak++;
                } else if (i > 0) {
                  break;
                }
                checkDate.setDate(checkDate.getDate() - 1);
              }
            }
          }

          return {
            user_id: p.user_id,
            score: p.score,
            username: p.users?.username || 'Unknown',
            isCurrentUser: p.user_id === user.id,
            streak,
            todayValue: todayValues[p.user_id] ?? null,
          };
        })
      );

      // Sort based on competition type
      if (typeConfig.sortOrder === 'asc') {
        entries.sort((a, b) => a.score - b.score);
      } else {
        entries.sort((a, b) => b.score - a.score);
      }

      setLeaderboard(entries);
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

    const compType = (competition?.competition_type || 'reading') as CompetitionType;
    const today = new Date().toISOString().split('T')[0];

    let valueToLog: number | null = null;
    let scoreAmount = 1;

    if (compType === 'running') {
      const km = parseFloat(logValue);
      if (!logValue || isNaN(km) || km <= 0) {
        showToast('Please enter valid kilometers', 'error');
        setCheckingIn(false);
        return;
      }
      valueToLog = km;
      scoreAmount = Math.round(km);
    } else if (compType === 'screen_time') {
      const hrs = parseFloat(logValue);
      if (!logValue || isNaN(hrs) || hrs < 0) {
        showToast('Please enter valid hours', 'error');
        setCheckingIn(false);
        return;
      }
      valueToLog = hrs;
      scoreAmount = 1;
    }

    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('id, completed')
      .eq('competition_id', id)
      .eq('user_id', user.id)
      .eq('date_logged', today)
      .maybeSingle();

    if (existingLog) {
      if (existingLog.completed) {
        setCheckedInToday(true);
        setCheckingIn(false);
        return;
      }
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

    const { error: scoreError } = await supabase.rpc('increment_score', {
      comp_id: id,
      uid: user.id,
      amount: scoreAmount,
    });

    if (scoreError) {
      const { error: updateError } = await supabase
        .from('participants')
        .update({ score: leaderboard.find((e) => e.isCurrentUser)!?.score + scoreAmount })
        .eq('competition_id', id)
        .eq('user_id', user.id);

      if (updateError) {
        showToast('Score update failed', 'error');
        setCheckingIn(false);
        return;
      }
    }

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'daily_goal_met',
      event_data: { competition_id: id, value: valueToLog },
    });

    setCheckedInToday(true);
    setCheckingIn(false);
    setLogValue('');
    const typeConfig = getCompetitionTypeConfig(compType);
    showToast(`${typeConfig.label} logged!`, 'success');
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
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(competition.join_code);
        showToast('Join code copied!', 'success');
      }
    } catch {
      showToast('Could not copy code', 'error');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const compType = (competition?.competition_type || 'reading') as CompetitionType;
  const typeConfig = getCompetitionTypeConfig(compType);
  const colorSet = typeConfig.colorSet;
  const daysLeft = getDaysRemaining();
  const active = isCompetitionActive();
  const maxScore = Math.max(...leaderboard.map((e) => e.score), 1);

  const getScoreDisplay = (entry: LeaderboardEntry) => {
    if (compType === 'reading') {
      return `${entry.score} ${entry.score === 1 ? 'day' : 'days'}`;
    }
    if (compType === 'running') {
      return `${entry.score} km`;
    }
    if (compType === 'screen_time') {
      const hrs = entry.score;
      return `${hrs} hr${hrs !== 1 ? 's' : ''}`;
    }
    return `${entry.score}`;
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank = index + 1;
    const medalColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : null;
    const hasFlame = item.streak > 1;
    const barWidth = maxScore > 0 ? (item.score / maxScore) * 100 : 0;

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
          {TYPE_ICONS[compType]}
          <Text style={[styles.scoreText, { color: colorSet[600] }]}>{getScoreDisplay(item)}</Text>
        </View>
      </View>
    );
  };

  const getCheckInLabel = () => {
    if (compType === 'reading') return "Log Today's Reading";
    if (compType === 'running') return "Log Today's Running";
    return "Log Today's Screen Time";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          {TYPE_ICONS[compType]}
          <Text style={styles.headerTitle} numberOfLines={1}>{competition?.title}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={leaderboard}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item) => item.user_id}
        ListHeaderComponent={
          <View style={styles.infoSection}>
            <View style={styles.competitionInfo}>
              <View style={[styles.infoChip, { backgroundColor: colorSet[50] }]}>
                {TYPE_ICONS[compType]}
                <Text style={[styles.infoChipText, { color: colorSet[700] }]}>{typeConfig.label}</Text>
              </View>
              <View style={[styles.infoChip, { backgroundColor: colorSet[50] }]}>
                <Calendar size={14} color={colorSet[600]} />
                <Text style={[styles.infoChipText, { color: colorSet[700] }]}>
                  {formatDate(competition?.start_date)} - {formatDate(competition?.end_date)}
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

            {competition?.join_code && (
              <View style={styles.joinCodeSection}>
                <View style={[styles.joinCodeCard, { borderColor: colorSet[200] }]}>
                  <Text style={styles.joinCodeLabel}>INVITE CODE</Text>
                  <Text style={[styles.joinCodeValue, { color: colorSet[600] }]}>{competition.join_code}</Text>
                </View>
                <TouchableOpacity style={[styles.copyCodeButton, { backgroundColor: colorSet[100] }]} onPress={handleCopyCode}>
                  <Copy size={16} color={colorSet[600]} />
                  <Text style={[styles.copyCodeText, { color: colorSet[600] }]}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            {active && (
              <View style={styles.checkInSection}>
                {compType !== 'reading' && !checkedInToday && (
                  <View style={styles.valueInputGroup}>
                    <Text style={styles.valueLabel}>
                      {compType === 'running' ? 'Kilometers ran today' : 'Hours of screen time today'}
                    </Text>
                    <TextInput
                      style={styles.valueInput}
                      value={logValue}
                      onChangeText={setLogValue}
                      placeholder={compType === 'running' ? 'e.g. 5.2' : 'e.g. 2.5'}
                      placeholderTextColor={Colors.neutral[400]}
                      keyboardType="decimal-pad"
                      maxLength={6}
                    />
                    <Text style={styles.valueUnit}>
                      {compType === 'running' ? 'km' : 'hours'}
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
                      <Text style={styles.checkInText}>{getCheckInLabel()}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.leaderboardHeader}>
              <Trophy size={20} color={Colors.warm[500]} />
              <Text style={styles.leaderboardTitle}>
                {compType === 'screen_time' ? 'Lowest Wins' : 'Leaderboard'}
              </Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colorSet[500]} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
    flexDirection: 'row',
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
    backgroundColor: '#FFF5E8',
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
  scoreText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
});
