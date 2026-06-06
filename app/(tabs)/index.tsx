import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { Trophy, Calendar, Users, Plus, Flame, Zap, LogIn, BookOpen, Activity, Smartphone } from 'lucide-react-native';
import { showToast } from '@/components/Toast';
import { CompetitionType, formatScore, getCompetitionTypeConfig } from '@/constants/competition';

interface ParticipantInfo {
  user_id: string;
  score: number;
}

interface CompetitionWithParticipation {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  creator_id: string;
  join_code: string;
  competition_type: string;
  participants: ParticipantInfo[];
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  reading: <BookOpen size={20} color={Colors.primary[500]} />,
  running: <Activity size={20} color={Colors.blue[500]} />,
  screen_time: <Smartphone size={20} color={Colors.teal[500]} />,
};

const TYPE_ICONS_SMALL: Record<string, React.ReactNode> = {
  reading: <BookOpen size={14} color={Colors.primary[600]} />,
  running: <Activity size={14} color={Colors.blue[600]} />,
  screen_time: <Smartphone size={14} color={Colors.teal[600]} />,
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [competitions, setCompetitions] = useState<CompetitionWithParticipation[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchCompetitions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('participants')
      .select('competition_id, competitions!inner(*)')
      .eq('user_id', user.id);

    if (error) {
      showToast('Failed to load competitions', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const compIds = data.map((p: any) => p.competition_id);
    if (compIds.length === 0) {
      setCompetitions([]);
      setStreaks({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: compData, error: compError } = await supabase
      .from('competitions')
      .select('*, participants(user_id, score)')
      .in('id', compIds)
      .order('created_at', { ascending: false });

    if (compError) {
      showToast('Failed to load competitions', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setCompetitions(compData || []);

    // Compute the current user's streak per competition from recent daily_logs.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentLogs } = await supabase
      .from('daily_logs')
      .select('competition_id, date_logged')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('competition_id', compIds)
      .gte('date_logged', thirtyDaysAgo.toISOString().split('T')[0]);

    const byComp: Record<string, Set<string>> = {};
    (recentLogs || []).forEach((log: any) => {
      if (!byComp[log.competition_id]) byComp[log.competition_id] = new Set();
      byComp[log.competition_id].add(log.date_logged);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const computed: Record<string, number> = {};
    compIds.forEach((cid: string) => {
      const days = byComp[cid];
      let streak = 0;
      if (days && days.size > 0) {
        const checkDate = new Date(today);
        for (let i = 0; i < 30; i++) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (days.has(dateStr)) {
            streak++;
          } else if (i > 0) {
            break;
          }
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
      computed[cid] = streak;
    });
    setStreaks(computed);

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

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
      .select('id')
      .eq('join_code', code)
      .single();

    if (findError || !comp) {
      showToast('Invalid join code', 'error');
      setJoining(false);
      return;
    }

    const { data: existing } = await supabase
      .from('participants')
      .select('user_id')
      .eq('competition_id', comp.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      showToast('You are already in this competition', 'error');
      setJoining(false);
      return;
    }

    const { error: joinError } = await supabase.from('participants').insert({
      competition_id: comp.id,
      user_id: user.id,
      score: 0,
    });

    if (joinError) {
      showToast('Failed to join competition', 'error');
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
    showToast('Joined competition!', 'success');
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

  const getMyScore = (comp: CompetitionWithParticipation) => {
    if (!user) return 0;
    const me = comp.participants?.find((p) => p.user_id === user.id);
    return me?.score || 0;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const renderCompetition = ({ item }: { item: CompetitionWithParticipation }) => {
    const compType = (item.competition_type || 'reading') as CompetitionType;
    const typeConfig = getCompetitionTypeConfig(compType);
    const colorSet = typeConfig.colorSet;
    const active = isCompetitionActive(item);
    const daysLeft = getDaysRemaining(item);
    const participantCount = item.participants?.length || 0;
    const myScore = getMyScore(item);
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

    // Progress bar:
    //   - Reading: how many of the total days have been logged (score == days).
    //   - Running / screen_time: how far through the competition window we are
    //     in real time. Score isn't directly comparable to a day count.
    let progressPct: number;
    if (compType === 'reading') {
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

    const scoreDisplay = formatScore(compType, myScore);

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colorSet[500] }]}
        onPress={() => router.push(`/competition/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.typeChipSmall, { backgroundColor: colorSet[100] }]}>
              {TYPE_ICONS_SMALL[compType]}
              <Text style={[styles.typeChipText, { color: colorSet[700] }]}>{typeConfig.label}</Text>
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
          <View style={styles.iconRow}>
            {TYPE_ICONS[compType]}
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          </View>
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
      <View style={styles.header}>
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
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
        </KeyboardAvoidingView>
      </Modal>
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
  },
  greeting: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  subGreeting: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
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
    backgroundColor: Colors.neutral[100],
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
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
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
    backgroundColor: '#FFF5E8',
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
    backgroundColor: Colors.neutral[100],
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
    borderTopColor: Colors.neutral[100],
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
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
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
    borderColor: Colors.border,
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
