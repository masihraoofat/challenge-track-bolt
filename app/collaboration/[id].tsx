import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { showToast } from '@/components/Toast';
import { CompetitionIcon } from '@/components/CompetitionIcon';
import { CollaborationChartCarousel } from '@/components/CollaborationChartCarousel';
import { UserAvatar } from '@/components/UserAvatar';
import {
  ArrowLeft,
  Calendar,
  Users,
  Copy,
  Trash2,
  LogOut,
  UserPlus,
  CircleCheck as CheckCircle2,
} from 'lucide-react-native';
import {
  resolveCompetitionColorSet,
  toLocalDateString,
  toScoreNumber,
} from '@/constants/competition';
import {
  type CollaborationRow,
  type CollaborationGoalPeriod,
  type CollaborationLog,
  type PeriodType,
  formatCollabUnitScore,
  getCurrentPeriodBucket,
  isCollaborationActive,
  isCollaborationContinuous,
  sumMemberLogsInBucket,
} from '@/constants/collaboration';
import { buildCollaborationChartSeries } from '@/lib/collaborationChartData';
import {
  type FriendUser,
  fetchFriends,
  inviteFriendToCollaboration,
} from '@/lib/friends';

interface CollabMember {
  user_id: string;
  users: { username: string; avatar_url: string | null };
}

export default function CollaborationDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [collaboration, setCollaboration] = useState<
    (CollaborationRow & { collaboration_goal_periods: CollaborationGoalPeriod[] }) | null
  >(null);
  const [members, setMembers] = useState<CollabMember[]>([]);
  const [logs, setLogs] = useState<CollaborationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isActiveMember, setIsActiveMember] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [logValue, setLogValue] = useState('');
  const [logging, setLogging] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<FriendUser[]>([]);
  const [loadingInviteFriends, setLoadingInviteFriends] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!id || !user) return;

    const { data: collab, error: collabError } = await supabase
      .from('collaborations')
      .select('*, collaboration_goal_periods(id, collaboration_id, period_type, target_value)')
      .eq('id', id)
      .single();

    if (collabError || !collab) {
      showToast('Collaboration not found', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setCollaboration(collab as typeof collaboration);

    const [{ data: myMembership }, { data: memberRows }, { data: allLogs }] = await Promise.all([
      supabase
        .from('collaboration_members')
        .select('left_at')
        .eq('collaboration_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('collaboration_members')
        .select('user_id, users!inner(username, avatar_url)')
        .eq('collaboration_id', id)
        .is('left_at', null),
      supabase
        .from('collaboration_logs')
        .select('user_id, date_logged, value')
        .eq('collaboration_id', id)
        .eq('completed', true),
    ]);

    setIsActiveMember(!!myMembership && myMembership.left_at === null);
    setHasLeft(!!myMembership && myMembership.left_at !== null);
    setMembers((memberRows ?? []) as unknown as CollabMember[]);
    setLogs(allLogs ?? []);

    const today = toLocalDateString();
    const { data: todayLog } = await supabase
      .from('collaboration_logs')
      .select('id')
      .eq('collaboration_id', id)
      .eq('user_id', user.id)
      .eq('date_logged', today)
      .eq('completed', true)
      .maybeSingle();

    setCheckedInToday(!!todayLog);
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

  const colorSet = resolveCompetitionColorSet(collaboration?.color ?? 'teal');
  const canLog =
    collaboration &&
    isCollaborationActive(collaboration) &&
    isActiveMember;

  const chartSeries = useMemo(() => {
    if (!collaboration) return [];
    return buildCollaborationChartSeries({
      startDate: collaboration.start_date,
      endDate: collaboration.end_date ?? null,
      goalMode: collaboration.goal_mode,
      unitLabel: collaboration.unit_label,
      overallTargetValue: collaboration.overall_target_value,
      goalPeriods: (collaboration.collaboration_goal_periods ?? []).map((p) => ({
        period_type: p.period_type as PeriodType,
        target_value: p.target_value,
      })),
      logs,
      members: members.map((m) => ({
        user_id: m.user_id,
        username: m.users.username,
      })),
    });
  }, [collaboration, logs, members]);

  const currentBucket = useMemo(() => {
    if (!collaboration) return null;
    if (collaboration.goal_mode === 'overall') {
      return getCurrentPeriodBucket('weekly', collaboration.start_date, collaboration.end_date ?? null);
    }
    const firstPeriod = collaboration.collaboration_goal_periods[0];
    if (!firstPeriod) return null;
    return getCurrentPeriodBucket(
      firstPeriod.period_type as PeriodType,
      collaboration.start_date,
      collaboration.end_date ?? null,
    );
  }, [collaboration]);

  const handleLog = async () => {
    if (!user || !id || checkedInToday || !canLog) return;

    const amount = parseFloat(logValue);
    if (!logValue.trim() || isNaN(amount) || amount < 0) {
      showToast(
        `Please enter a valid number of ${collaboration?.unit_label || 'units'}`,
        'error',
      );
      return;
    }

    setLogging(true);
    const today = toLocalDateString();

    const { data: existingLog } = await supabase
      .from('collaboration_logs')
      .select('id')
      .eq('collaboration_id', id)
      .eq('user_id', user.id)
      .eq('date_logged', today)
      .maybeSingle();

    if (existingLog) {
      const { error } = await supabase
        .from('collaboration_logs')
        .update({ completed: true, value: amount })
        .eq('id', existingLog.id);
      if (error) {
        showToast('Failed to log progress', 'error');
        setLogging(false);
        return;
      }
    } else {
      const { error } = await supabase.from('collaboration_logs').insert({
        collaboration_id: id,
        user_id: user.id,
        date_logged: today,
        completed: true,
        value: amount,
      });
      if (error) {
        showToast('Failed to log progress', 'error');
        setLogging(false);
        return;
      }
    }

    setLogging(false);
    setLogValue('');
    setCheckedInToday(true);
    showToast('Progress logged!', 'success');
    fetchData();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCopyCode = async () => {
    if (!collaboration?.join_code) return;
    try {
      await Clipboard.setStringAsync(collaboration.join_code);
      showToast('Join code copied!', 'success');
    } catch {
      showToast('Could not copy code', 'error');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const isCreator = collaboration?.creator_id === user?.id;

  const openInviteModal = async () => {
    if (!user || !id) return;
    setInviteModalVisible(true);
    setLoadingInviteFriends(true);

    const [friends, invitesResult] = await Promise.all([
      fetchFriends(user.id),
      supabase
        .from('collaboration_invitations')
        .select('invitee_id')
        .eq('collaboration_id', id)
        .eq('status', 'pending'),
    ]);

    const memberIds = new Set(members.map((m) => m.user_id));
    const pendingIds = new Set((invitesResult.data ?? []).map((row) => row.invitee_id));

    setInviteFriends(friends.filter((f) => !memberIds.has(f.id)));
    setInvitedFriendIds(pendingIds);
    setLoadingInviteFriends(false);
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!id) return;
    setInvitingFriendId(friendId);
    const { error } = await inviteFriendToCollaboration(id, friendId);
    setInvitingFriendId(null);
    if (error) {
      showToast(error, 'error');
      return;
    }
    setInvitedFriendIds((prev) => new Set(prev).add(friendId));
    showToast('Invitation sent!', 'success');
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    const { error } = await supabase.rpc('delete_collaboration', { collab_id: id });
    setDeleting(false);
    setDeleteModalVisible(false);
    if (error) {
      showToast('Failed to delete collaboration', 'error');
      return;
    }
    showToast('Collaboration deleted', 'success');
    router.replace('/(tabs)');
  };

  const confirmLeave = async () => {
    if (!id) return;
    setLeaving(true);
    const { error } = await supabase.rpc('leave_collaboration', { collab_id: id });
    setLeaving(false);
    setLeaveModalVisible(false);
    if (error) {
      showToast('Failed to leave collaboration', 'error');
      return;
    }
    showToast('You left the collaboration', 'success');
    fetchData();
  };

  const handleRejoin = async () => {
    if (!id) return;
    setRejoining(true);
    const { error } = await supabase.rpc('join_collaboration', { collab_id: id });
    setRejoining(false);
    if (error) {
      showToast('Failed to rejoin', 'error');
      return;
    }
    showToast('Welcome back!', 'success');
    fetchData();
  };

  const handleUserPress = (userId: string) => {
    if (userId === user?.id) {
      router.push('/profile');
      return;
    }
    router.push({ pathname: '/user/[id]', params: { id: userId } });
  };

  if (loading || !collaboration) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const active = isCollaborationActive(collaboration);
  const continuous = isCollaborationContinuous(collaboration);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, Spacing.lg) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {collaboration.title}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isCreator && (
            <TouchableOpacity onPress={() => setDeleteModalVisible(true)} style={styles.iconButton}>
              <Trash2 size={20} color={Colors.red[500]} />
            </TouchableOpacity>
          )}
          {isActiveMember && !isCreator && (
            <TouchableOpacity onPress={() => setLeaveModalVisible(true)} style={styles.iconButton}>
              <LogOut size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />
        }
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.heroCard, { backgroundColor: colorSet[50], borderColor: colorSet[200] }]}>
          <View style={[styles.heroIcon, { backgroundColor: colorSet[100] }]}>
            <CompetitionIcon icon={(collaboration.icon as any) ?? 'activity'} size={32} colorSet={colorSet} />
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.metaRow}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {formatDate(collaboration.start_date)}
                {collaboration.end_date
                  ? ` - ${formatDate(collaboration.end_date)}`
                  : ' - Ongoing'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Users size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{members.length} members</Text>
            </View>
            <TouchableOpacity style={styles.codeRow} onPress={handleCopyCode}>
              <Text style={[styles.codeText, { color: colorSet[600] }]}>
                {collaboration.join_code}
              </Text>
              <Copy size={14} color={colorSet[600]} />
            </TouchableOpacity>
          </View>
          <View style={[styles.statusPill, active ? styles.statusActive : styles.statusEnded]}>
            <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextEnded]}>
              {active ? (continuous ? 'Ongoing' : 'Active') : 'Ended'}
            </Text>
          </View>
        </View>

        {collaboration.description ? (
          <Text style={styles.description}>{collaboration.description}</Text>
        ) : null}

        <CollaborationChartCarousel seriesList={chartSeries} colorSet={colorSet} />

        {hasLeft && active && (
          <TouchableOpacity
            style={[styles.rejoinButton, { backgroundColor: colorSet[500] }]}
            onPress={handleRejoin}
            disabled={rejoining}
          >
            {rejoining ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.rejoinText}>Rejoin Collaboration</Text>
            )}
          </TouchableOpacity>
        )}

        {canLog && (
          <View style={[styles.logCard, { borderColor: colorSet[200] }]}>
            <Text style={styles.sectionLabel}>Log Today</Text>
            {checkedInToday ? (
              <View style={styles.loggedRow}>
                <CheckCircle2 size={20} color={Colors.success[500]} />
                <Text style={styles.loggedText}>Logged for today</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.logInput}
                  value={logValue}
                  onChangeText={setLogValue}
                  placeholder={`Amount in ${collaboration.unit_label || 'units'}`}
                  placeholderTextColor={Colors.neutral[400]}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.logButton, { backgroundColor: colorSet[500] }]}
                  onPress={handleLog}
                  disabled={logging}
                >
                  {logging ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.logButtonText}>Log Progress</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={styles.membersSection}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionLabel}>Members</Text>
            {isCreator && active && (
              <TouchableOpacity style={styles.inviteButton} onPress={openInviteModal}>
                <UserPlus size={16} color={Colors.primary[600]} />
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
          {members.map((member) => {
            const periodTotal =
              currentBucket != null
                ? sumMemberLogsInBucket(logs, member.user_id, currentBucket)
                : 0;
            return (
              <TouchableOpacity
                key={member.user_id}
                style={styles.memberRow}
                onPress={() => handleUserPress(member.user_id)}
              >
                <UserAvatar avatarUrl={member.users.avatar_url} size={36} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.users.username}</Text>
                  {currentBucket && (
                    <Text style={styles.memberScore}>
                      This period: {formatCollabUnitScore(periodTotal, collaboration.unit_label)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete collaboration?</Text>
            <Text style={styles.modalBody}>This cannot be undone.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDanger} onPress={confirmDelete} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalDangerText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={leaveModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Leave collaboration?</Text>
            <Text style={styles.modalBody}>Your past logs will be kept if you rejoin.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setLeaveModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDanger} onPress={confirmLeave} disabled={leaving}>
                {leaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalDangerText}>Leave</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={inviteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.inviteModal, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <Text style={styles.modalTitle}>Invite Friends</Text>
            {loadingInviteFriends ? (
              <ActivityIndicator color={Colors.primary[500]} style={{ marginVertical: Spacing.lg }} />
            ) : inviteFriends.length === 0 ? (
              <Text style={styles.modalBody}>No friends available to invite</Text>
            ) : (
              <FlatList
                data={inviteFriends}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const invited = invitedFriendIds.has(item.id);
                  return (
                    <View style={styles.inviteRow}>
                      <UserAvatar avatarUrl={item.avatar_url} size={36} />
                      <Text style={styles.memberName}>{item.username}</Text>
                      <TouchableOpacity
                        style={[styles.inviteRowButton, invited && styles.inviteRowButtonDisabled]}
                        onPress={() => handleInviteFriend(item.id)}
                        disabled={invited || invitingFriendId === item.id}
                      >
                        {invitingFriendId === item.id ? (
                          <ActivityIndicator size="small" color={Colors.primary[600]} />
                        ) : (
                          <Text style={styles.inviteRowButtonText}>
                            {invited ? 'Sent' : 'Invite'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setInviteModalVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.mutedBorder,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, marginHorizontal: Spacing.sm },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: colors.text },
    headerActions: { flexDirection: 'row', gap: Spacing.xs },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingBottom: Spacing.xxl },
    heroCard: {
      margin: Spacing.lg,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroMeta: { flex: 1, gap: Spacing.xs, minWidth: 160 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    metaText: { fontSize: FontSizes.sm, color: colors.textSecondary },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
    codeText: { fontSize: FontSizes.md, fontWeight: '700', letterSpacing: 2 },
    statusPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      alignSelf: 'flex-start',
    },
    statusActive: { backgroundColor: Colors.success[100] },
    statusEnded: { backgroundColor: colors.muted },
    statusText: { fontSize: FontSizes.xs, fontWeight: '600' },
    statusTextActive: { color: Colors.success[600] },
    statusTextEnded: { color: Colors.neutral[500] },
    description: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    rejoinButton: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    rejoinText: { color: '#FFFFFF', fontWeight: '700', fontSize: FontSizes.md },
    logCard: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: Spacing.md,
    },
    sectionLabel: { fontSize: FontSizes.md, fontWeight: '700', color: colors.text },
    logInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: FontSizes.md,
      color: colors.text,
      backgroundColor: colors.background,
    },
    logButton: {
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    logButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: FontSizes.md },
    loggedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    loggedText: { fontSize: FontSizes.md, color: Colors.success[600], fontWeight: '600' },
    membersSection: {
      marginHorizontal: Spacing.lg,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.mutedBorder,
    },
    membersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: Colors.primary[100],
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    inviteButtonText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary[600] },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.mutedBorder,
    },
    memberInfo: { flex: 1 },
    memberName: { fontSize: FontSizes.md, fontWeight: '600', color: colors.text },
    memberScore: { fontSize: FontSizes.sm, color: colors.textSecondary, marginTop: 2 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    inviteModal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      maxHeight: '70%',
      marginTop: 'auto',
    },
    modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm },
    modalBody: { fontSize: FontSizes.md, color: colors.textSecondary, marginBottom: Spacing.lg },
    modalActions: { flexDirection: 'row', gap: Spacing.md },
    modalCancel: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalCancelText: { fontWeight: '600', color: colors.textSecondary },
    modalDanger: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.red[500],
    },
    modalDangerText: { fontWeight: '700', color: '#FFFFFF' },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    inviteRowButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary[100],
    },
    inviteRowButtonDisabled: { opacity: 0.5 },
    inviteRowButtonText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.primary[600] },
  });
}
