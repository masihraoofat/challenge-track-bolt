import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Trophy, Calendar, Users, Plus, Flame, Zap, LogIn } from 'lucide-react-native';
import { showToast } from '@/components/Toast';
import { CompetitionIcon } from '@/components/CompetitionIcon';
import {
  aggregateLogScore,
  computeStreakFromDates,
  formatLeaderboardScore,
  getCompetitionConfig,
  resolveCompetitionScore,
  toLocalDateString,
  toScoreNumber,
} from '@/constants/competition';

interface ParticipantInfo {
  user_id: string;
  score: number;
  left_at?: string | null;
}

interface CompetitionWithParticipation {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  creator_id: string;
  join_code: string;
  icon?: string | null;
  color?: string | null;
  scoring_mode?: string;
  unit_label?: string | null;
  score_limit?: number | null;
  description?: string | null;
  participants: ParticipantInfo[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [competitions, setCompetitions] = useState<CompetitionWithParticipation[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [myScores, setMyScores] = useState<
    Record<string, { score: number; hasLogged: boolean }>
  >({});

  const fetchCompetitions = useCallback(async () => {
    if (!user) return;

    const { data: memberships, error: memberError } = await supabase
      .from('participants')
      .select('competition_id')
      .eq('user_id', user.id)
      .is('left_at', null);

    if (memberError) {
      showToast('Failed to load competitions', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const compIds = (memberships || []).map((p) => p.competition_id);
    if (compIds.length === 0) {
      setCompetitions([]);
      setStreaks({});
      setMyScores({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = toLocalDateString(thirtyDaysAgo);

    const [compResult, logsResult] = await Promise.all([
      supabase
        .from('competitions')
        .select('*, participants(user_id, score, left_at)')
        .in('id', compIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('daily_logs')
        .select('competition_id, value, date_logged')
        .eq('user_id', user.id)
        .eq('completed', true)
        .in('competition_id', compIds)
        .gte('date_logged', thirtyDaysAgoStr),
    ]);

    if (compResult.error) {
      showToast('Failed to load competitions', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const compData = compResult.data || [];
    setCompetitions(compData);

    const logsByComp: Record<string, { value: unknown }[]> = {};
    const byComp: Record<string, Set<string>> = {};

    (logsResult.data || []).forEach((log) => {
      if (!logsByComp[log.competition_id]) {
        logsByComp[log.competition_id] = [];
      }
      logsByComp[log.competition_id].push(log);

      if (!byComp[log.competition_id]) {
        byComp[log.competition_id] = new Set();
      }
      byComp[log.competition_id].add(log.date_logged);
    });

    const scoreMap: Record<string, { score: number; hasLogged: boolean }> = {};
    const computed: Record<string, number> = {};

    compData.forEach((comp: any) => {
      const config = getCompetitionConfig(comp);
      const me = comp.participants?.find((p: any) => p.user_id === user.id);
      const logInfo = aggregateLogScore(config, logsByComp[comp.id] ?? []);
      scoreMap[comp.id] = resolveCompetitionScore(
        config,
        me?.score,
        logInfo.total,
        logInfo.count,
      );
      computed[comp.id] = computeStreakFromDates(byComp[comp.id] ?? new Set());
    });

    setMyScores(scoreMap);
    setStreaks(computed);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchCompetitions();
    }, [fetchCompetitions]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompetitions();
  };

  const handleJoinCompetition = async () => {
    if (!joinCode.trim()) {
      showToast('Please enter a join code', 'error');
      return;
    }
    if (!user) return;

    setJoining(true);
    const code = joinCode.trim().toUpperCase();

    const { data: comp, error: findError } = await supabase
      .from('competitions')
      .select('id, end_date')
      .eq('join_code', code)
      .single();

    if (findError || !comp) {
      showToast('Invalid join code', 'error');
      setJoining(false);
      return;
    }

    const { data: priorMembership } = await supabase
      .from('participants')
      .select('left_at')
      .eq('competition_id', comp.id)
      .eq('user_id', user.id)
      .maybeSingle();

    const { error: joinError } = await supabase.rpc('join_competition', { comp_id: comp.id });

    if (joinError) {
      const msg = joinError.message.toLowerCase();
      if (msg.includes('already joined')) {
        showToast('You are already in this competition', 'error');
      } else if (msg.includes('ended')) {
        showToast('This competition has ended', 'error');
      } else {
        showToast('Failed to join competition', 'error');
      }
      setJoining(false);
      return;
    }

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'competition_joined',
      event_data: { competition_id: comp.id, join_code: code },
    });

    setJoining(false);
    setJoinModalVisible(false);
    setJoinCode('');
    showToast(
      priorMembership?.left_at ? 'Welcome back! Your progress was restored.' : 'Joined competition!',
      'success',
    );
    fetchCompetitions();
  };

  const isCompetitionActive = (comp: CompetitionWithParticipation) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(comp.start_date + 'T00:00:00');
    const end = new Date(comp.end_date + 'T00:00:00');
    return today >= start && today <= end;
  };

  const getDaysRemaining = (comp: CompetitionWithParticipation) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(comp.end_date + 'T00:00:00');
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMyScoreDisplay = (comp: CompetitionWithParticipation) => {
    const config = getCompetitionConfig(comp);
    const resolved = myScores[comp.id];
    if (resolved) {
      return formatLeaderboardScore(config, resolved.score, resolved.hasLogged);
    }
    const me = comp.participants?.find((p) => p.user_id === user?.id);
    return formatLeaderboardScore(config, toScoreNumber(me?.score), false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const renderCompetition = ({ item }: { item: CompetitionWithParticipation }) => {
    const config = getCompetitionConfig(item);
    const colorSet = config.colorSet;
    const active = isCompetitionActive(item);
    const daysLeft = getDaysRemaining(item);
    const participantCount = item.participants?.filter((p) => !p.left_at).length || 0;
    const resolvedScore = myScores[item.id];
    const myScore = resolvedScore?.score ?? 0;
    const streak = streaks[item.id] ?? 0;
    const hasFlame = streak > 1;

    const start = new Date(item.start_date + 'T00:00:00');
    const end = new Date(item.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    let progressPct: number;
    if (config.scoringMode === 'daily') {
      progressPct = Math.min(100, (myScore / totalDays) * 100);
    } else {
      const elapsed = Math.max(
        0,
        Math.min(
          totalDays,
          Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        )
      );
      progressPct = Math.min(100, (elapsed / totalDays) * 100);
    }

    const scoreDisplay = getMyScoreDisplay(item);

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colorSet[500] }]}
        onPress={() => router.push(`/competition/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.typeChipSmall, { backgroundColor: colorSet[100] }]}>
              <CompetitionIcon icon={config.icon} size={14} colorSet={colorSet} />
              <Text style={[styles.typeChipText, { color: colorSet[700] }]}>{config.label}</Text>
            </View>
            <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusEnded]}>
              <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextEnded]}>
                {active ? 'Active' : 'Ended'}
              </Text>
            </View>
          </View>
          <View style={styles.participantCount}>
            <Users size={14} color={Colors.neutral[500]} />
            <Text style={styles.participantText}>{participantCount}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {config.description ? (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {config.description}
            </Text>
          ) : null}
          <View style={styles.dateRow}>
            <Calendar size={14} color={Colors.neutral[400]} />
            <Text style={styles.dateText}>
              {formatDate(item.start_date)} - {formatDate(item.end_date)}
            </Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreLeft}>
              <Zap size={16} color={colorSet[500]} />
              <Text style={styles.scoreLabel}>Your score</Text>
            </View>
            <View style={styles.scoreRight}>
              {hasFlame && (
                <View style={styles.flameBadge}>
                  <Flame size={14} color={Colors.warm[500]} />
                  <Text style={styles.flameText}>{streak} day streak</Text>
                </View>
              )}
              <Text style={[styles.scoreNumber, { color: colorSet[600] }]}>{scoreDisplay}</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: colorSet[500] }]} />
          </View>
        </View>

        {active && (
          <View style={styles.cardFooter}>
            <Text style={[styles.daysText, { color: colorSet[600] }]}>
              {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'Final day!'}
            </Text>
            <Trophy size={16} color={Colors.warm[500]} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <View>
          <Text style={styles.greeting}>Your Competitions</Text>
          <Text style={styles.subGreeting}>Keep the streak going</Text>
        </View>
        <TouchableOpacity style={styles.joinButton} onPress={() => setJoinModalVisible(true)}>
          <LogIn size={18} color={Colors.primary[600]} />
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      </View>

      {competitions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Trophy size={48} color={Colors.neutral[300]} />
          </View>
          <Text style={styles.emptyTitle}>No competitions yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your first competition or join one with a code!
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyCreateButton}
              onPress={() => router.push('/(tabs)/create')}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.emptyCreateText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptyJoinButton}
              onPress={() => setJoinModalVisible(true)}
            >
              <LogIn size={18} color={Colors.primary[600]} />
              <Text style={styles.emptyJoinText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={competitions}
          renderItem={renderCompetition}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/create')}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={joinModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join a Competition</Text>
            <Text style={styles.modalSubtitle}>
              Enter the join code shared by the competition creator
            </Text>

            <TextInput
              style={styles.modalInput}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Enter join code"
              placeholderTextColor={Colors.neutral[400]}
              autoCapitalize="characters"
              maxLength={8}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setJoinModalVisible(false);
                  setJoinCode('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalJoinButton, joining && styles.modalJoinButtonDisabled]}
                onPress={handleJoinCompetition}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalJoinText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  subGreeting: {
    fontSize: FontSizes.md,
    color: colors.textSecondary,
    marginTop: Spacing.xs,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary[100],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  joinButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.mutedBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typeChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  typeChipText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusActive: {
    backgroundColor: Colors.success[100],
  },
  statusEnded: {
    backgroundColor: colors.muted,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  statusTextActive: {
    color: Colors.success[600],
  },
  statusTextEnded: {
    color: Colors.neutral[500],
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantText: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[500],
  },
  cardBody: {
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: colors.text,
  },
  cardDescription: {
    fontSize: FontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateText: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[400],
  },
  scoreSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  scoreLabel: {
    fontSize: FontSizes.sm,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  scoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
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
    fontWeight: '600',
    color: Colors.warm[500],
  },
  scoreNumber: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.progressTrack,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.mutedBorder,
  },
  daysText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary[500],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyCreateText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyJoinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary[100],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyJoinText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: FontSizes.md,
    color: colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.neutral[600],
  },
  modalJoinButton: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary[500],
  },
  modalJoinButtonDisabled: {
    opacity: 0.7,
  },
  modalJoinText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
}
