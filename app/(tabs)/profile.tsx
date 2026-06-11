import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { User, BookOpen, Trophy, Flame, Settings } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { computeStreakFromDates } from '@/constants/competition';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ competitions: 0, daysLogged: 0, currentStreak: 0 });
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
          marginHorizontal: Spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: BorderRadius.xl,
          borderWidth: 1,
          borderColor: colors.mutedBorder,
          marginBottom: Spacing.lg,
        },
        avatar: {
          width: 80,
          height: 80,
          borderRadius: BorderRadius.full,
          backgroundColor: Colors.primary[100],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.md,
        },
        username: {
          fontSize: FontSizes.xl,
          fontWeight: '700',
          color: colors.text,
        },
        email: {
          fontSize: FontSizes.sm,
          color: colors.textSecondary,
          marginTop: Spacing.xs,
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

  const fetchStats = useCallback(async () => {
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const [compResult, daysResult, logsResult] = await Promise.all([
      supabase
        .from('participants')
        .select('competition_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true),
      supabase
        .from('daily_logs')
        .select('date_logged')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('date_logged', dateStr)
        .order('date_logged', { ascending: false }),
    ]);

    const loggedDates = new Set((logsResult.data || []).map((l) => l.date_logged));
    const streak = computeStreakFromDates(loggedDates, 7);

    setStats({
      competitions: compResult.count ?? 0,
      daysLogged: daysResult.count ?? 0,
      currentStreak: streak,
    });
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats]),
  );

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Reader';

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
        <View style={styles.avatar}>
          <User size={40} color={Colors.primary[600]} />
        </View>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
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
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      )}
    </View>
  );
}
