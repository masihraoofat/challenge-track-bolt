import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes, ThemeColors } from '@/constants/theme';
import { UserAvatar } from '@/components/UserAvatar';
import { CompetitionIcon } from '@/components/CompetitionIcon';
import {
  formatLeaderboardScore,
  getCompetitionConfig,
  type CompetitionRow,
} from '@/constants/competition';
import { buildLeaderboardEntries, type LeaderboardEntry } from '@/lib/leaderboard';
import { showToast } from '@/components/Toast';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;
const PODIUM_MIN_HEIGHT = 220;
const DISMISS_DELAY_MS = 280;

interface CompetitionResultsModalProps {
  visible: boolean;
  competition: CompetitionRow & { id: string; title: string };
  onClose: () => void;
  onViewed: () => void;
}

export function CompetitionResultsModal({
  visible,
  competition,
  onClose,
  onViewed,
}: CompetitionResultsModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const config = useMemo(() => getCompetitionConfig(competition), [competition]);
  const colorSet = config.colorSet;

  const [loading, setLoading] = useState(true);
  const [topThree, setTopThree] = useState<LeaderboardEntry[]>([]);
  const [marking, setMarking] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!visible || !user) return;

    let cancelled = false;
    closingRef.current = false;
    setLoading(true);
    setTopThree([]);

    async function loadResults() {
      const [{ data: participants }, { data: allLogs }] = await Promise.all([
        supabase
          .from('participants')
          .select('user_id, score, users!inner(username, avatar_url)')
          .eq('competition_id', competition.id)
          .is('left_at', null),
        supabase
          .from('daily_logs')
          .select('user_id, value, date_logged')
          .eq('competition_id', competition.id)
          .eq('completed', true),
      ]);

      if (cancelled || !user) return;

      const entries = buildLeaderboardEntries(
        config,
        participants ?? [],
        allLogs ?? [],
        user.id,
      );

      setTopThree(entries.slice(0, 3));
      setLoading(false);
    }

    loadResults();

    return () => {
      cancelled = true;
    };
  }, [visible, user, competition.id, config]);

  const markViewed = async () => {
    setMarking(true);
    const { error } = await supabase.rpc('mark_competition_results_viewed', {
      comp_id: competition.id,
    });
    setMarking(false);

    if (error) {
      showToast('Failed to save results', 'error');
      return false;
    }

    return true;
  };

  const finishDismiss = (navigateToDetail = false) => {
    onViewed();
    onClose();

    if (navigateToDetail) {
      setTimeout(() => {
        router.push(`/competition/${competition.id}?readonly=1`);
      }, DISMISS_DELAY_MS);
    }
  };

  const handleClose = async () => {
    if (closingRef.current || marking) return;
    closingRef.current = true;

    const ok = await markViewed();
    if (!ok) {
      closingRef.current = false;
      return;
    }

    finishDismiss(false);
  };

  const handleViewFull = async () => {
    if (closingRef.current || marking) return;
    closingRef.current = true;

    const ok = await markViewed();
    if (!ok) {
      closingRef.current = false;
      return;
    }

    finishDismiss(true);
  };

  const podiumOrder = [
    topThree[1] ?? null,
    topThree[0] ?? null,
    topThree[2] ?? null,
  ];

  const renderPodiumSlot = (entry: LeaderboardEntry | null, rank: number) => {
    const medalColor = MEDAL_COLORS[rank - 1];
    const isFirst = rank === 1;
    const avatarSize = isFirst ? 64 : 52;
    const podiumHeight = isFirst ? 88 : rank === 2 ? 64 : 48;

    if (!entry) {
      return <View key={rank} style={styles.podiumSlot} />;
    }

    return (
      <View key={entry.user_id} style={styles.podiumSlot}>
        <Trophy size={isFirst ? 22 : 18} color={medalColor} fill={medalColor} />
        <UserAvatar avatarUrl={entry.avatar_url} size={avatarSize} />
        <Text style={[styles.podiumName, isFirst && styles.podiumNameFirst]} numberOfLines={1}>
          {entry.username}
          {entry.isCurrentUser ? ' (You)' : ''}
        </Text>
        <Text style={[styles.podiumScore, { color: colorSet[600] }]}>
          {formatLeaderboardScore(config, entry.score, entry.hasLogged)}
        </Text>
        <View style={[styles.podiumBar, { height: podiumHeight, backgroundColor: medalColor }]} />
        <Text style={styles.podiumRank}>{rank}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} disabled={marking} />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={[styles.typeChip, { backgroundColor: colorSet[100] }]}>
              <CompetitionIcon icon={config.icon} size={14} colorSet={colorSet} />
              <Text style={[styles.typeChipText, { color: colorSet[700] }]}>{config.label}</Text>
            </View>
          </View>

          <Text style={styles.title}>{competition.title}</Text>
          <Text style={styles.subtitle}>Final Results</Text>

          <View style={styles.podiumContainer}>
            {loading ? (
              <ActivityIndicator size="large" color={Colors.primary[500]} />
            ) : topThree.length === 0 ? (
              <Text style={styles.emptyText}>No results to show yet.</Text>
            ) : (
              <View style={styles.podiumRow}>
                {podiumOrder.map((entry, idx) => {
                  const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                  return renderPodiumSlot(entry, rank);
                })}
              </View>
            )}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={marking}
            >
              {marking ? (
                <ActivityIndicator color={Colors.neutral[600]} size="small" />
              ) : (
                <Text style={styles.cancelText}>Close</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, (marking || loading) && styles.viewButtonDisabled]}
              onPress={handleViewFull}
              disabled={marking || loading}
            >
              <Text style={styles.viewButtonText}>View full results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    content: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl,
    },
    headerRow: {
      flexDirection: 'row',
      marginBottom: Spacing.sm,
    },
    typeChip: {
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
    title: {
      fontSize: FontSizes.xl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: FontSizes.md,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
    },
    podiumContainer: {
      minHeight: PODIUM_MIN_HEIGHT,
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    emptyText: {
      fontSize: FontSizes.md,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.md,
    },
    podiumSlot: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    podiumName: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    podiumNameFirst: {
      fontSize: FontSizes.md,
    },
    podiumScore: {
      fontSize: FontSizes.xs,
      fontWeight: '600',
      textAlign: 'center',
    },
    podiumBar: {
      width: '100%',
      borderTopLeftRadius: BorderRadius.sm,
      borderTopRightRadius: BorderRadius.sm,
      opacity: 0.85,
    },
    podiumRank: {
      fontSize: FontSizes.xs,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    buttons: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontSize: FontSizes.md,
      fontWeight: '600',
      color: Colors.neutral[600],
    },
    viewButton: {
      flex: 1,
      paddingVertical: Spacing.md + 2,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.primary[500],
    },
    viewButtonDisabled: {
      opacity: 0.7,
    },
    viewButtonText: {
      fontSize: FontSizes.md,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
