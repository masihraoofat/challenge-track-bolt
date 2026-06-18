import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { BookOpen, Trophy, Flame, Settings, Pencil } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserAvatar } from '@/components/UserAvatar';

interface UserProfile {
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ competitions: 0, daysLogged: 0, challengesWon: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.md,
        },
        headerTitle: {
          fontSize: FontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
        },
        settingsButton: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: BorderRadius.full,
          backgroundColor: colors.muted,
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
        email: {
          fontSize: FontSizes.sm,
          color: colors.textSecondary,
          marginTop: Spacing.xs,
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
        editButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
          marginTop: Spacing.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.muted,
        },
        editButtonText: {
          fontSize: FontSizes.sm,
          fontWeight: '600',
          color: colors.text,
        },
        loader: {
          marginTop: Spacing.xl,
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
      }),
    [colors],
  );

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [profileResult, compResult, daysResult] = await Promise.all([
      supabase
        .from('users')
        .select('username, bio, avatar_url, challenges_won')
        .eq('id', user.id)
        .single(),
      supabase
        .from('participants')
        .select('competition_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
    }

    setStats({
      competitions: compResult.count ?? 0,
      daysLogged: daysResult.count ?? 0,
      challengesWon: profileResult.data?.challenges_won ?? 0,
    });
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const username =
    profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Reader';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Settings size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <UserAvatar avatarUrl={profile?.avatar_url} size={80} />
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioPlaceholder}>Add a bio to tell others about yourself</Text>
        )}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
        >
          <Pencil size={14} color={colors.text} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary[500]} style={styles.loader} />
      ) : (
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
            <Text style={styles.statValue}>{stats.challengesWon}</Text>
            <Text style={styles.statLabel}>Challenges Won</Text>
          </View>
        </View>
      )}
    </View>
  );
}
