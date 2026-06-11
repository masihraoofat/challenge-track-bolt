import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { ArrowLeft, LogOut, Moon } from 'lucide-react-native';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { isDark, colors, setDarkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.md,
          gap: Spacing.md,
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
          fontSize: FontSizes.xxl,
          fontWeight: '700',
          color: colors.text,
        },
        section: {
          marginHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: BorderRadius.xl,
          borderWidth: 1,
          borderColor: colors.mutedBorder,
          overflow: 'hidden',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.md,
        },
        rowLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
        },
        rowLabel: {
          fontSize: FontSizes.md,
          fontWeight: '600',
          color: colors.text,
        },
        rowSubtext: {
          fontSize: FontSizes.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        divider: {
          height: 1,
          backgroundColor: colors.mutedBorder,
          marginLeft: Spacing.lg + 20 + Spacing.md,
        },
        signOutButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.sm,
          marginHorizontal: Spacing.lg,
          marginTop: 'auto',
          marginBottom: Spacing.xxl,
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
      }),
    [colors],
  );

  const handleSignOut = async () => {
    await signOut();
    showToast('Logged out successfully', 'info');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Moon size={20} color={Colors.primary[500]} />
            <View>
              <Text style={styles.rowLabel}>Dark Mode</Text>
              <Text style={styles.rowSubtext}>Use a dark color scheme</Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={setDarkMode}
            trackColor={{ false: Colors.neutral[300], true: Colors.primary[400] }}
            thumbColor={isDark ? Colors.primary[600] : Colors.surface}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <LogOut size={20} color={Colors.error[500]} />
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}
