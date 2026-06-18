import { supabase } from '@/lib/supabase';

export type FriendshipStatus =
  | 'none'
  | 'friends'
  | 'pending_sent'
  | 'pending_received';

export interface FriendUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface FriendRequest {
  user: FriendUser;
  created_at: string;
}

export interface CompetitionInvite {
  id: string;
  created_at: string;
  competition: {
    id: string;
    title: string;
    icon: string;
    color: string;
    join_code: string;
  };
  inviter: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

function parseRpcError(error: { message: string }): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('already friends')) return 'You are already friends';
  if (msg.includes('request already sent')) return 'Friend request already sent';
  if (msg.includes('cannot friend yourself')) return 'You cannot add yourself';
  if (msg.includes('user not found')) return 'User not found';
  if (msg.includes('not friends')) return 'You are not friends with this user';
  if (msg.includes('not the creator')) return 'Only the challenge creator can invite';
  if (msg.includes('competition has ended')) return 'This challenge has ended';
  if (msg.includes('already joined')) return 'They have already joined this challenge';
  if (msg.includes('request not found')) return 'Request not found';
  if (msg.includes('invitation not found')) return 'Invitation not found';
  return error.message;
}

export async function searchUsers(
  query: string,
  excludeUserId: string,
): Promise<{ users: FriendUser[]; error: string | null }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { users: [], error: null };
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, bio')
    .ilike('username', `%${trimmed}%`)
    .neq('id', excludeUserId)
    .limit(20);

  if (error) return { users: [], error: error.message };
  return { users: data ?? [], error: null };
}

export async function getFriendshipStatus(
  currentUserId: string,
  otherUserId: string,
): Promise<FriendshipStatus> {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${currentUserId})`,
    )
    .maybeSingle();

  if (!data) return 'none';
  if (data.status === 'accepted') return 'friends';
  if (data.status === 'pending') {
    return data.requester_id === currentUserId ? 'pending_sent' : 'pending_received';
  }
  return 'none';
}

export async function fetchFriends(userId: string): Promise<FriendUser[]> {
  const { data } = await supabase
    .from('friendships')
    .select(
      `
      requester_id,
      addressee_id,
      requester:requester_id(id, username, avatar_url, bio),
      addressee:addressee_id(id, username, avatar_url, bio)
    `,
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (!data) return [];

  return data.map((row) => {
    const friend =
      row.requester_id === userId
        ? (row.addressee as unknown as FriendUser)
        : (row.requester as unknown as FriendUser);
    return friend;
  });
}

export async function fetchIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const { data } = await supabase
    .from('friendships')
    .select(
      `
      created_at,
      requester:requester_id(id, username, avatar_url, bio)
    `,
    )
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    user: row.requester as unknown as FriendUser,
    created_at: row.created_at,
  }));
}

export async function fetchOutgoingRequests(userId: string): Promise<FriendRequest[]> {
  const { data } = await supabase
    .from('friendships')
    .select(
      `
      created_at,
      addressee:addressee_id(id, username, avatar_url, bio)
    `,
    )
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    user: row.addressee as unknown as FriendUser,
    created_at: row.created_at,
  }));
}

export async function fetchCompetitionInvites(userId: string): Promise<CompetitionInvite[]> {
  const { data } = await supabase
    .from('competition_invitations')
    .select(
      `
      id,
      created_at,
      competition:competition_id(id, title, icon, color, join_code),
      inviter:inviter_id(id, username, avatar_url)
    `,
    )
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data as unknown as CompetitionInvite[];
}

export async function sendFriendRequest(
  targetId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('send_friend_request', { target_id: targetId });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function acceptFriendRequest(
  requesterId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('accept_friend_request', { requester_id: requesterId });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function declineFriendRequest(
  requesterId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('decline_friend_request', { requester_id: requesterId });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function cancelFriendRequest(
  addresseeId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancel_friend_request', { addressee_id: addresseeId });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function removeFriend(friendId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('remove_friend', { friend_id: friendId });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function inviteFriendToCompetition(
  compId: string,
  friendId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('invite_friend_to_competition', {
    comp_id: compId,
    friend_id: friendId,
  });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function respondCompetitionInvitation(
  invitationId: string,
  accept: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('respond_competition_invitation', {
    invitation_id: invitationId,
    accept,
  });
  if (error) return { error: parseRpcError(error) };
  return { error: null };
}

export async function fetchUserProfile(userId: string): Promise<{
  profile: (FriendUser & { challenges_won: number }) | null;
  stats: { competitions: number; daysLogged: number };
  error: string | null;
}> {
  const [profileResult, compResult, daysResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, username, avatar_url, bio, challenges_won')
      .eq('id', userId)
      .single(),
    supabase
      .from('participants')
      .select('competition_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('daily_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true),
  ]);

  if (profileResult.error) {
    return { profile: null, stats: { competitions: 0, daysLogged: 0 }, error: profileResult.error.message };
  }

  return {
    profile: profileResult.data,
    stats: {
      competitions: compResult.count ?? 0,
      daysLogged: daysResult.count ?? 0,
    },
    error: null,
  };
}
