import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { User, LogOut, BookOpen, Trophy, Flame } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({ competitions: 0, totalScore: 0, currentStreak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      const { data: participations } = await supabase
        .from('participants')
        .select('score')
        .eq('user_id', user.id);

      const compCount = participations?.length || 0;
      const totalScore = participations?.reduce((sum: number, p: any) => sum + p.score, 0) || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];

      const { data: recentLogs } = await supabase
        .from('daily_logs')
        .select('date_logged')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('date_logged', dateStr)
        .order('date_logged', { ascending: false });

      let streak = 0;
      if (recentLogs && recentLogs.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(today);

        for (let i = 0; i < 7; i++) {
          const dateStr2 = checkDate.toISOString().split('T')[0];
          const found = recentLogs.some((log: any) => log.date_logged === dateStr2);
          if (found) {
            streak++;
          } else if (i > 0) {
            break;
          }
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }

      setStats({ competitions: compCount, totalScore, currentStreak: streak });
      setLoading(false);
    }
    fetchStats();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    showToast('Logged out successfully', 'info');
  };

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Reader';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
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
            <Text style={styles.statValue}>{stats.totalScore}</Text>
            <Text style={styles.statLabel}>Total Score</Text>
          </View>
          <View style={styles.statCard}>
            <Trophy size={24} color={Colors.success[500]} />
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={Colors.error[500]} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
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
    color: Colors.text,
  },
  email: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
  },
  statValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error[50],
    borderWidth: 1,
    borderColor: Colors.error[100],
  },
  signOutText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.error[500],
  },
});
