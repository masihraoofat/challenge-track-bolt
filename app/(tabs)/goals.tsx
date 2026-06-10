import { useState, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { toLocalDateString } from '@/constants/competition';
import {
  GoalType,
  GoalLogStats,
  GOAL_TYPES,
  GOAL_TYPE_ORDER,
  computeGoalLogStats,
  formatGoalStat,
  formatGoalTodayValue,
  getGoalCheckInLabel,
  getGoalLogInputType,
  getGoalLogValueLabel,
  getGoalTypeConfig,
  normalizeGoalType,
  parseGoalLogValue,
} from '@/constants/goals';
import {
  Target,
  Plus,
  Flame,
  Hash,
  Clock,
  CheckCircle,
  CircleCheck as CheckCircle2,
  Trash2,
} from 'lucide-react-native';

interface Goal {
  id: string;
  name: string;
  goal_type: string;
  created_at: string;
}

const TYPE_ICONS: Record<GoalType, React.ReactNode> = {
  streak: <Flame size={20} color={Colors.primary[500]} />,
  amount: <Hash size={20} color={Colors.blue[500]} />,
  time: <Clock size={20} color={Colors.teal[500]} />,
  checkin: <CheckCircle size={20} color={Colors.success[500]} />,
};

const TYPE_ICONS_SMALL: Record<GoalType, React.ReactNode> = {
  streak: <Flame size={14} color={Colors.primary[600]} />,
  amount: <Hash size={14} color={Colors.blue[600]} />,
  time: <Clock size={14} color={Colors.teal[600]} />,
  checkin: <CheckCircle size={14} color={Colors.success[600]} />,
};

export default function GoalsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('streak');
  const [saving, setSaving] = useState(false);
  const [goalStats, setGoalStats] = useState<Record<string, GoalLogStats>>({});
  const [logInputs, setLogInputs] = useState<
    Record<string, { value: string; hours: string; minutes: string }>
  >({});
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('goals')
      .select('id, name, goal_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Failed to load goals', 'error');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const goalList = data || [];
    setGoals(goalList);

    if (goalList.length === 0) {
      setGoalStats({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const goalIds = goalList.map((g) => g.id);
    const { data: logs, error: logsError } = await supabase
      .from('goal_logs')
      .select('goal_id, date_logged, value')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('goal_id', goalIds);

    if (logsError) {
      showToast('Failed to load goal progress', 'error');
    }

    const today = toLocalDateString();
    const logsByGoal: Record<string, { date_logged: string; value: unknown }[]> = {};
    (logs || []).forEach((log) => {
      if (!logsByGoal[log.goal_id]) logsByGoal[log.goal_id] = [];
      logsByGoal[log.goal_id].push(log);
    });

    const stats: Record<string, GoalLogStats> = {};
    goalList.forEach((goal) => {
      stats[goal.id] = computeGoalLogStats(logsByGoal[goal.id] || [], today);
    });
    setGoalStats(stats);

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchGoals();
    }, [fetchGoals]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchGoals();
  };

  const resetForm = () => {
    setName('');
    setGoalType('streak');
    setSaving(false);
  };

  const handleAddGoal = async () => {
    if (!name.trim()) {
      showToast('Please enter a goal name', 'error');
      return;
    }
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      name: name.trim(),
      goal_type: goalType,
    });

    if (error) {
      showToast('Failed to create goal', 'error');
      setSaving(false);
      return;
    }

    showToast('Goal created!', 'success');
    setModalVisible(false);
    resetForm();
    fetchGoals();
  };

  const handleDeleteGoal = async (goalId: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', goalId);

    if (error) {
      showToast('Failed to delete goal', 'error');
      return;
    }

    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    setGoalStats((prev) => {
      const next = { ...prev };
      delete next[goalId];
      return next;
    });
    showToast('Goal deleted', 'info');
  };

  const updateLogInput = (
    goalId: string,
    field: 'value' | 'hours' | 'minutes',
    text: string,
  ) => {
    setLogInputs((prev) => ({
      ...prev,
      [goalId]: {
        value: field === 'value' ? text : prev[goalId]?.value ?? '',
        hours: field === 'hours' ? text : prev[goalId]?.hours ?? '',
        minutes: field === 'minutes' ? text : prev[goalId]?.minutes ?? '',
      },
    }));
  };

  const handleLogGoal = async (goal: Goal) => {
    if (!user) return;

    const type = normalizeGoalType(goal.goal_type);
    const stats = goalStats[goal.id];
    if (stats?.checkedInToday) return;

    const inputs = logInputs[goal.id] ?? { value: '', hours: '', minutes: '' };
    const parsed = parseGoalLogValue(type, inputs.value, inputs.hours, inputs.minutes);
    if ('error' in parsed) {
      showToast(parsed.error, 'error');
      return;
    }

    setCheckingInId(goal.id);
    const today = toLocalDateString();

    const { data: existingLog } = await supabase
      .from('goal_logs')
      .select('id')
      .eq('goal_id', goal.id)
      .eq('date_logged', today)
      .maybeSingle();

    if (existingLog) {
      const { error } = await supabase
        .from('goal_logs')
        .update({ completed: true, value: parsed.value })
        .eq('id', existingLog.id);

      if (error) {
        showToast('Failed to log progress', 'error');
        setCheckingInId(null);
        return;
      }
    } else {
      const { error } = await supabase.from('goal_logs').insert({
        goal_id: goal.id,
        user_id: user.id,
        date_logged: today,
        completed: true,
        value: parsed.value,
      });

      if (error) {
        showToast('Failed to log progress', 'error');
        setCheckingInId(null);
        return;
      }
    }

    setLogInputs((prev) => ({
      ...prev,
      [goal.id]: { value: '', hours: '', minutes: '' },
    }));
    setCheckingInId(null);
    showToast('Progress logged!', 'success');
    fetchGoals();
  };

  const renderGoal = ({ item }: { item: Goal }) => {
    const config = getGoalTypeConfig(item.goal_type);
    const colorSet = config.colorSet;
    const type = normalizeGoalType(item.goal_type);
    const stats = goalStats[item.id] ?? {
      checkedInToday: false,
      todayValue: null,
      streak: 0,
      total: 0,
      logCount: 0,
    };
    const logInputType = getGoalLogInputType(type);
    const inputs = logInputs[item.id] ?? { value: '', hours: '', minutes: '' };
    const isCheckingIn = checkingInId === item.id;
    const checkInLabel = getGoalCheckInLabel(type);

    return (
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colorSet[500] }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeChip, { backgroundColor: colorSet[100] }]}>
            {TYPE_ICONS_SMALL[type]}
            <Text style={[styles.typeChipText, { color: colorSet[700] }]}>{config.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteGoal(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color={Colors.neutral[400]} />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          {TYPE_ICONS[type]}
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
        </View>
        <Text style={[styles.statText, { color: colorSet[600] }]}>
          {formatGoalStat(type, stats)}
        </Text>

        <View style={styles.logSection}>
          {logInputType === 'number' && !stats.checkedInToday && (
            <View style={styles.valueInputGroup}>
              <Text style={styles.valueLabel}>{getGoalLogValueLabel(type)}</Text>
              <TextInput
                style={styles.valueInput}
                value={inputs.value}
                onChangeText={(text) => updateLogInput(item.id, 'value', text)}
                placeholder="e.g. 5"
                placeholderTextColor={Colors.neutral[400]}
                keyboardType="decimal-pad"
                maxLength={8}
              />
            </View>
          )}
          {logInputType === 'duration' && !stats.checkedInToday && (
            <View style={styles.valueInputGroup}>
              <Text style={styles.valueLabel}>{getGoalLogValueLabel(type)}</Text>
              <View style={styles.durationInputRow}>
                <View style={styles.durationField}>
                  <TextInput
                    style={styles.durationInput}
                    value={inputs.hours}
                    onChangeText={(text) => updateLogInput(item.id, 'hours', text)}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral[400]}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.durationUnit}>hr</Text>
                </View>
                <View style={styles.durationField}>
                  <TextInput
                    style={styles.durationInput}
                    value={inputs.minutes}
                    onChangeText={(text) => updateLogInput(item.id, 'minutes', text)}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral[400]}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.durationUnit}>min</Text>
                </View>
              </View>
            </View>
          )}
          {stats.checkedInToday && logInputType !== 'checkin' && stats.todayValue != null && (
            <View style={[styles.loggedTodayCard, { backgroundColor: colorSet[50] }]}>
              <Text style={styles.loggedTodayLabel}>Logged today</Text>
              <Text style={[styles.loggedTodayValue, { color: colorSet[700] }]}>
                {formatGoalTodayValue(type, stats.todayValue)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.logButton,
              { backgroundColor: colorSet[500] },
              stats.checkedInToday && { backgroundColor: Colors.success[500] },
            ]}
            onPress={() => handleLogGoal(item)}
            disabled={stats.checkedInToday || isCheckingIn}
            activeOpacity={0.8}
          >
            {isCheckingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : stats.checkedInToday ? (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.logButtonText}>Logged today!</Text>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.logButtonText}>{checkInLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <View>
          <Text style={styles.title}>Goals</Text>
          <Text style={styles.subtitle}>Set personal targets for yourself</Text>
        </View>
      </View>

      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Target size={48} color={Colors.neutral[300]} />
          </View>
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a goal to start tracking your personal progress
          </Text>
          <TouchableOpacity
            style={styles.emptyAddButton}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.emptyAddText}>Add Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={goals}
          renderItem={renderGoal}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {goals.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Goal</Text>
              <Text style={styles.modalSubtitle}>
                Give your goal a name and choose how you want to track it
              </Text>

              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Read 30 minutes daily"
                placeholderTextColor={Colors.neutral[400]}
                autoFocus
              />

              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeGrid}>
                {GOAL_TYPE_ORDER.map((type) => {
                  const config = GOAL_TYPES[type];
                  const selected = goalType === type;
                  const colorSet = config.colorSet;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        selected && {
                          borderColor: colorSet[500],
                          backgroundColor: colorSet[50],
                        },
                      ]}
                      onPress={() => setGoalType(type)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.typeOptionIcon, { backgroundColor: colorSet[100] }]}>
                        {TYPE_ICONS[type]}
                      </View>
                      <Text style={[styles.typeOptionLabel, selected && { color: colorSet[700] }]}>
                        {config.label}
                      </Text>
                      <Text style={styles.typeOptionDesc} numberOfLines={2}>
                        {config.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveButton, saving && styles.modalSaveButtonDisabled]}
                  onPress={handleAddGoal}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Add Goal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
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
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  deleteButton: {
    padding: Spacing.xs,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  statText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginLeft: 28,
    marginBottom: Spacing.md,
  },
  logSection: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
  },
  valueInputGroup: {
    marginBottom: Spacing.md,
  },
  valueLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  valueInput: {
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  durationInputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  durationField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  durationInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  durationUnit: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loggedTodayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  loggedTodayLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loggedTodayValue: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  logButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
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
    marginBottom: Spacing.xl,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[600],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyAddText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeOption: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.neutral[200],
    backgroundColor: Colors.surface,
  },
  typeOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  typeOptionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  typeOptionDesc: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.neutral[600],
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary[600],
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
