import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { UserAvatar } from '@/components/UserAvatar';
import { CompetitionIcon } from '@/components/CompetitionIcon';
import { showToast } from '@/components/Toast';
import { resolveCompetitionColorSet, type CompetitionIcon as CompetitionIconName } from '@/constants/competition';
import {
  Search,
  UserPlus,
  Check,
  X,
  Users,
} from 'lucide-react-native';
import {
  type FriendUser,
  type FriendRequest,
  type CompetitionInvite,
  type CollaborationInvite,
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  fetchCompetitionInvites,
  fetchCollaborationInvites,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  respondCompetitionInvitation,
  respondCollaborationInvitation,
} from '@/lib/friends';

type Tab = 'friends' | 'requests' | 'find';

export default function FriendsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<CompetitionInvite[]>([]);
  const [collabInvites, setCollabInvites] = useState<CollaborationInvite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionInviteId, setActionInviteId] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [friendsData, incomingData, outgoingData, invitesData, collabInvitesData] =
      await Promise.all([
      fetchFriends(user.id),
      fetchIncomingRequests(user.id),
      fetchOutgoingRequests(user.id),
      fetchCompetitionInvites(user.id),
      fetchCollaborationInvites(user.id),
    ]);

    setFriends(friendsData);
    setIncoming(incomingData);
    setOutgoing(outgoingData);
    setInvites(invitesData);
    setCollabInvites(collabInvitesData);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleSearch = useCallback(async () => {
    if (!user || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const { users, error } = await searchUsers(searchQuery, user.id);
    setSearching(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    setSearchResults(users);
  }, [user, searchQuery]);

  const handleAddFriend = async (targetId: string) => {
    setActionUserId(targetId);
    const { error } = await sendFriendRequest(targetId);
    setActionUserId(null);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast('Friend request sent!', 'success');
    await fetchData();
  };

  const handleAccept = async (requesterId: string) => {
    setActionUserId(requesterId);
    const { error } = await acceptFriendRequest(requesterId);
    setActionUserId(null);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast('Friend added!', 'success');
    fetchData();
  };

  const handleDecline = async (requesterId: string) => {
    setActionUserId(requesterId);
    const { error } = await declineFriendRequest(requesterId);
    setActionUserId(null);

    if (error) {
      showToast(error, 'error');
      return;
    }

    fetchData();
  };

  const handleCancel = async (addresseeId: string) => {
    setActionUserId(addresseeId);
    const { error } = await cancelFriendRequest(addresseeId);
    setActionUserId(null);

    if (error) {
      showToast(error, 'error');
      return;
    }

    fetchData();
  };

  const handleCompetitionInviteResponse = async (invitationId: string, accept: boolean) => {
    setActionInviteId(invitationId);
    const { error } = await respondCompetitionInvitation(invitationId, accept);
    setActionInviteId(null);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast(accept ? 'Joined challenge!' : 'Invitation declined', accept ? 'success' : 'info');
    fetchData();
    if (accept) {
      const invite = invites.find((i) => i.id === invitationId);
      if (invite) router.push(`/competition/${invite.competition.id}`);
    }
  };

  const handleCollaborationInviteResponse = async (invitationId: string, accept: boolean) => {
    setActionInviteId(invitationId);
    const { error } = await respondCollaborationInvitation(invitationId, accept);
    setActionInviteId(null);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast(accept ? 'Joined collaboration!' : 'Invitation declined', accept ? 'success' : 'info');
    fetchData();
    if (accept) {
      const invite = collabInvites.find((i) => i.id === invitationId);
      if (invite) router.push(`/collaboration/${invite.collaboration.id}` as Href);
    }
  };

  const requestCount = incoming.length + outgoing.length;

  const renderUserRow = (
    friendUser: FriendUser,
    rightAction?: React.ReactNode,
  ) => (
    <View style={styles.userRow}>
      <TouchableOpacity
        style={styles.userRowMain}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: friendUser.id } })}
        activeOpacity={0.7}
      >
        <UserAvatar avatarUrl={friendUser.avatar_url} size={44} />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{friendUser.username}</Text>
          {friendUser.bio ? (
            <Text style={styles.bio} numberOfLines={1}>
              {friendUser.bio}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {rightAction}
    </View>
  );

  const renderInvite = (invite: CompetitionInvite) => {
    const colorSet = resolveCompetitionColorSet(invite.competition.color);
    const busy = actionInviteId === invite.id;

    return (
      <View style={styles.inviteCard} key={invite.id}>
        <View style={styles.inviteHeader}>
          <CompetitionIcon icon={invite.competition.icon as CompetitionIconName} size={18} colorSet={colorSet} />
          <View style={styles.inviteInfo}>
            <Text style={styles.inviteTitle}>{invite.competition.title}</Text>
            <Text style={styles.inviteSubtext}>
              Invited by {invite.inviter.username}
            </Text>
          </View>
        </View>
        <View style={styles.inviteActions}>
          <TouchableOpacity
            style={[styles.declineButton, busy && styles.buttonDisabled]}
            onPress={() => handleCompetitionInviteResponse(invite.id, false)}
            disabled={busy}
          >
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, busy && styles.buttonDisabled]}
            onPress={() => handleCompetitionInviteResponse(invite.id, true)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Join</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCollabInvite = (invite: CollaborationInvite) => {
    const colorSet = resolveCompetitionColorSet(invite.collaboration.color);
    const busy = actionInviteId === invite.id;

    return (
      <View style={styles.inviteCard} key={invite.id}>
        <View style={styles.inviteHeader}>
          <CompetitionIcon icon={invite.collaboration.icon as CompetitionIconName} size={18} colorSet={colorSet} />
          <View style={styles.inviteInfo}>
            <Text style={styles.inviteTitle}>{invite.collaboration.title}</Text>
            <Text style={styles.inviteSubtext}>
              Collab invite from {invite.inviter.username}
            </Text>
          </View>
        </View>
        <View style={styles.inviteActions}>
          <TouchableOpacity
            style={[styles.declineButton, busy && styles.buttonDisabled]}
            onPress={() => handleCollaborationInviteResponse(invite.id, false)}
            disabled={busy}
          >
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, busy && styles.buttonDisabled]}
            onPress={() => handleCollaborationInviteResponse(invite.id, true)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Join</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFriendsTab = () => (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
      }
      ListHeaderComponent={
        invites.length > 0 || collabInvites.length > 0 ? (
          <View style={styles.section}>
            {invites.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Challenge Invites</Text>
                {invites.map(renderInvite)}
              </>
            )}
            {collabInvites.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Collaboration Invites</Text>
                {collabInvites.map(renderCollabInvite)}
              </>
            )}
          </View>
        ) : null
      }
      renderItem={({ item }) => renderUserRow(item)}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="large" color={Colors.primary[500]} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Users size={40} color={Colors.neutral[400]} />
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyText}>Search for people to add as friends</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setTab('find')}>
              <Text style={styles.emptyButtonText}>Find Friends</Text>
            </TouchableOpacity>
          </View>
        )
      }
      contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.listContent}
    />
  );

  const renderRequestsTab = () => (
    <FlatList
      data={[...incoming.map((r) => ({ ...r, type: 'incoming' as const })), ...outgoing.map((r) => ({ ...r, type: 'outgoing' as const }))]}
      keyExtractor={(item) => `${item.type}-${item.user.id}`}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
      }
      ListHeaderComponent={
        <>
          {incoming.length > 0 && <Text style={styles.sectionTitle}>Incoming</Text>}
        </>
      }
      renderItem={({ item, index }) => {
        const isIncoming = item.type === 'incoming';
        const showOutgoingHeader = !isIncoming && index === incoming.length && outgoing.length > 0;
        const busy = actionUserId === item.user.id;

        return (
          <>
            {showOutgoingHeader && <Text style={[styles.sectionTitle, styles.outgoingHeader]}>Sent</Text>}
            {renderUserRow(
              item.user,
              isIncoming ? (
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleDecline(item.user.id)}
                    disabled={busy}
                  >
                    <X size={18} color={Colors.error[500]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptSmallButton, busy && styles.buttonDisabled]}
                    onPress={() => handleAccept(item.user.id)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Check size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancel(item.user.id)}
                  disabled={busy}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              ),
            )}
          </>
        );
      }}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="large" color={Colors.primary[500]} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <UserPlus size={40} color={Colors.neutral[400]} />
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.emptyText}>Friend requests will show up here</Text>
          </View>
        )
      }
      contentContainerStyle={requestCount === 0 ? styles.emptyContainer : styles.listContent}
    />
  );

  const renderFindTab = () => (
    <View style={styles.findContainer}>
      <View style={styles.searchBar}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {searching ? (
        <ActivityIndicator size="large" color={Colors.primary[500]} style={styles.loader} />
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isFriend = friends.some((f) => f.id === item.id);
            const isPending = outgoing.some((r) => r.user.id === item.id);
            const busy = actionUserId === item.id;

            let action: React.ReactNode = null;
            if (isFriend) {
              action = <Text style={styles.statusLabel}>Friends</Text>;
            } else if (isPending) {
              action = <Text style={styles.statusLabel}>Pending</Text>;
            } else {
              action = (
                <TouchableOpacity
                  style={[styles.addButton, busy && styles.buttonDisabled]}
                  onPress={() => handleAddFriend(item.id)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <UserPlus size={16} color="#FFFFFF" />
                      <Text style={styles.addButtonText}>Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            }

            return renderUserRow(item, action);
          }}
          ListEmptyComponent={
            searchQuery.trim().length >= 2 ? (
              <Text style={styles.noResults}>No users found</Text>
            ) : (
              <Text style={styles.searchHint}>Enter at least 2 characters to search</Text>
            )
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      <View style={styles.tabs}>
        {(['friends', 'requests', 'find'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'friends' ? 'Friends' : t === 'requests' ? `Requests${requestCount > 0 ? ` (${requestCount})` : ''}` : 'Find'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'friends' && renderFriendsTab()}
      {tab === 'requests' && renderRequestsTab()}
      {tab === 'find' && renderFindTab()}
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
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    headerTitle: {
      fontSize: FontSizes.xxl,
      fontWeight: '700',
      color: colors.text,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      borderRadius: BorderRadius.full,
      backgroundColor: colors.muted,
    },
    tabActive: {
      backgroundColor: Colors.primary[500],
    },
    tabText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    emptyContainer: {
      flexGrow: 1,
    },
    section: {
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: FontSizes.sm,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    outgoingHeader: {
      marginTop: Spacing.lg,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.mutedBorder,
      gap: Spacing.md,
    },
    userRowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    userInfo: {
      flex: 1,
    },
    username: {
      fontSize: FontSizes.md,
      fontWeight: '600',
      color: colors.text,
    },
    bio: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    requestActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'center',
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptSmallButton: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.success[500],
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.muted,
    },
    cancelButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary[500],
    },
    addButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    statusLabel: {
      fontSize: FontSizes.sm,
       fontWeight: '600',
      color: colors.textSecondary,
    },
    inviteCard: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.mutedBorder,
    },
    inviteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    inviteInfo: {
      flex: 1,
    },
    inviteTitle: {
      fontSize: FontSizes.md,
      fontWeight: '600',
      color: colors.text,
    },
    inviteSubtext: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    inviteActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
    },
    declineButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary[500],
    },
    acceptButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    findContainer: {
      flex: 1,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.mutedBorder,
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSizes.md,
      color: colors.text,
      paddingVertical: Spacing.xs,
    },
    searchButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary[500],
    },
    searchButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    searchHint: {
      textAlign: 'center',
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      marginTop: Spacing.xl,
    },
    noResults: {
      textAlign: 'center',
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      marginTop: Spacing.xl,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xxl,
      gap: Spacing.sm,
    },
    emptyTitle: {
      fontSize: FontSizes.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: Spacing.md,
    },
    emptyText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary[500],
    },
    emptyButtonText: {
      fontSize: FontSizes.sm,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    loader: {
      marginTop: Spacing.xxl,
    },
  });
}
