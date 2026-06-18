import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { UserAvatar } from '@/components/UserAvatar';
import { showToast } from '@/components/Toast';
import {
  ArrowLeft,
  BookOpen,
  Flame,
  Trophy,
  UserPlus,
  UserMinus,
  Check,
  X,
} from 'lucide-react-native';
import {
  type FriendshipStatus,
  fetchUserProfile,
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from '@/lib/friends';

export default function UserProfileScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const userId = Array.isArray(rawId) ? rawId[0] : rawId;
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    challenges_won: number;
  } | null>(null);
  const [stats, setStats] = useState({ competitions: 0, daysLogged: 0 });
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);

  const isOwnProfile = user?.id === userId;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchData = useCallback(async () => {
    if (!userId || !user) return;

    if (userId === user.id) {
      router.replace('/profile');
      return;
    }

    const [profileResult, status] = await Promise.all([
      fetchUserProfile(userId),
      getFriendshipStatus(user.id, userId),
    ]);

    if (profileResult.error || !profileResult.profile) {
      showToast('User not found', 'error');
      router.back();
      return;
    }

    setProfile(profileResult.profile);
    setStats(profileResult.stats);
    setFriendshipStatus(status);
    setLoading(false);
  }, [userId, user, router]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData]),
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/friends');
  };

  const refreshStatus = async () => {
    if (!user || !userId) return;
    const status = await getFriendshipStatus(user.id, userId);
    setFriendshipStatus(status);
  };

  const handleAddFriend = async () => {
    if (!userId) return;
    setActing(true);
    const { error } = await sendFriendRequest(userId);
    setActing(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast('Friend request sent!', 'success');
    await refreshStatus();
  };

  const handleAccept = async () => {
    if (!userId) return;
    setActing(true);
    const { error } = await acceptFriendRequest(userId);
    setActing(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast('Friend added!', 'success');
    setFriendshipStatus('friends');
  };

  const handleDecline = async () => {
    if (!userId) return;
    setActing(true);
    const { error } = await declineFriendRequest(userId);
    setActing(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    setFriendshipStatus('none');
  };

  const handleCancel = async () => {
    if (!userId) return;
    setActing(true);
    const { error } = await cancelFriendRequest(userId);
    setActing(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    setFriendshipStatus('none');
  };

  const confirmRemove = async () => {
    if (!userId) return;
    setActing(true);
    const { error } = await removeFriend(userId);
    setActing(false);
    setRemoveModalVisible(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast('Friend removed', 'info');
    setFriendshipStatus('none');
  };

  const renderFriendAction = () => {
    if (isOwnProfile || loading) return null;

    if (acting) {
      return (
        <View style={styles.actionButton}>
          <ActivityIndicator color="#FFFFFF" size="small" />
        </View>
      );
    }

    switch (friendshipStatus) {
      case 'friends':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.removeActionButton]}
            onPress={() => setRemoveModalVisible(true)}
          >
            <UserMinus size={16} color={Colors.error[500]} />
            <Text style={styles.removeActionText}>Remove Friend</Text>
          </TouchableOpacity>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleCancel}>
            <X size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Cancel Request</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
              <X size={18} color={Colors.error[500]} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleAccept}>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return (
          <TouchableOpacity style={styles.actionButton} onPress={handleAddFriend}>
            <UserPlus size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Add Friend</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary[500]} style={styles.loader} />
      ) : profile ? (
        <>
          <View style={styles.profileCard}>
            <UserAvatar avatarUrl={profile.avatar_url} size={80} />
            <Text style={styles.username}>{profile.username}</Text>
            {profile.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : (
              <Text style={styles.bioPlaceholder}>No bio yet</Text>
            )}
            {renderFriendAction()}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <BookOpen size={24} color={Colors.primary[500]} />
              <Text style={styles.statValue}>{stats.competitions}</Text>
              <Text style={styles.statLabel}>Competitions</Text>
            </View>
            <View style={styles.statCard}>
              <Flame size={24} color={Colors.warm[500]} />
              <Text style={styles.statValue}>{stats.daysLogged}</Text>
              <Text style={styles.statLabel}>Days Logged</Text>
            </View>
            <View style={styles.statCard}>
              <Trophy size={24} color={Colors.success[500]} />
              <Text style={styles.statValue}>{profile.challenges_won}</Text>
              <Text style={styles.statLabel}>Challenges Won</Text>
            </View>
          </View>
        </>
      ) : null}

      <Modal visible={removeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Remove friend?</Text>
            <Text style={styles.modalMessage}>
              {profile?.username} will be removed from your friends list.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRemoveModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmRemove}
                disabled={acting}
              >
                {acting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.full,
      backgroundColor: colors.muted,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: FontSizes.xxl,
      fontWeight: '700',
      color: colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    loader: {
      marginTop: Spacing.xxl,
    },
    profileCard: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      marginHorizontal: Spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: colors.mutedBorder,
      marginBottom: Spacing.lg,
    },
    username: {
      fontSize: FontSizes.xl,
      fontWeight: '700',
      color: colors.text,
      marginTop: Spacing.md,
    },
    bio: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.md,
      lineHeight: 20,
    },
    bioPlaceholder: {
      fontSize: FontSizes.sm,
      color: Colors.neutral[400],
      textAlign: 'center',
      marginTop: Spacing.md,
      fontStyle: 'italic',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary[500],
    },
    actionButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryButton: {
      backgroundColor: colors.muted,
    },
    secondaryButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
    removeActionButton: {
      backgroundColor: Colors.error[50],
      borderWidth: 1,
      borderColor: Colors.error[100],
    },
    removeActionText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: Colors.error[600],
    },
    requestActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
      alignItems: 'center',
    },
    declineButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.mutedBorder,
    },
    statValue: {
      fontSize: FontSizes.xxl,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      width: '100%',
      maxWidth: 340,
    },
    modalTitle: {
      fontSize: FontSizes.lg,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    modalMessage: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    modalCancel: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.muted,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: FontSizes.md,
      fontWeight: '600',
      color: colors.text,
    },
    modalConfirm: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.error[500],
      alignItems: 'center',
    },
    modalConfirmText: {
      fontSize: FontSizes.md,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
