import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { showToast } from '@/components/Toast';
import { ArrowLeft, Copy, Pipette, Trophy, Handshake } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import { CompetitionIcon } from '@/components/CompetitionIcon';
import { ColorPickerModal } from '@/components/ColorPickerModal';
import {
  COMPETITION_COLOR_ORDER,
  COMPETITION_COLORS,
  COMPETITION_ICON_ORDER,
  CompetitionIcon as CompetitionIconName,
  resolveCompetitionColorSet,
  SCORING_MODES,
  ScoringMode,
  toLocalDateString,
} from '@/constants/competition';
import { isCustomHexColor } from '@/lib/colorUtils';
import {
  type GoalMode,
  type PeriodType,
  PERIOD_TYPES,
  PERIOD_LABELS,
} from '@/constants/collaboration';

type CreateKind = 'competition' | 'collaboration';

const ICON_GAP = Spacing.sm;
const ICON_ROWS = [
  COMPETITION_ICON_ORDER.slice(0, 10),
  COMPETITION_ICON_ORDER.slice(10, 20),
] as const;

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initialKind: CreateKind | null =
    typeParam === 'collaboration' ? 'collaboration' : typeParam === 'competition' ? 'competition' : null;
  const [createKind, setCreateKind] = useState<CreateKind | null>(initialKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isContinuous, setIsContinuous] = useState(false);
  const [goalMode, setGoalMode] = useState<GoalMode>('periodic');
  const [selectedPeriods, setSelectedPeriods] = useState<PeriodType[]>(['weekly']);
  const [periodTargets, setPeriodTargets] = useState<Record<PeriodType, string>>({
    weekly: '',
    monthly: '',
    yearly: '',
  });
  const [overallTarget, setOverallTarget] = useState('');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('daily');
  const [unitLabel, setUnitLabel] = useState('');
  const [useDailyLimit, setUseDailyLimit] = useState(false);
  const [scoreLimit, setScoreLimit] = useState('');
  const [icon, setIcon] = useState<CompetitionIconName>(
    initialKind === 'collaboration' ? 'activity' : 'trophy',
  );
  const [color, setColor] = useState<string>(initialKind === 'collaboration' ? 'teal' : 'primary');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdKind, setCreatedKind] = useState<CreateKind>('competition');

  const today = toLocalDateString();
  const maxEndDate = new Date();
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);
  const maxEndDateStr = toLocalDateString(maxEndDate);

  const colorSet = resolveCompetitionColorSet(color);
  const customColorSelected = isCustomHexColor(color);

  const resetForm = useCallback(() => {
    setCreateKind(initialKind);
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setIsContinuous(false);
    setGoalMode('periodic');
    setSelectedPeriods(['weekly']);
    setPeriodTargets({ weekly: '', monthly: '', yearly: '' });
    setOverallTarget('');
    setScoringMode('daily');
    setUnitLabel('');
    setUseDailyLimit(false);
    setScoreLimit('');
    setIcon(initialKind === 'collaboration' ? 'activity' : 'trophy');
    setColor(initialKind === 'collaboration' ? 'teal' : 'primary');
    setColorPickerVisible(false);
    setCreatedCode(null);
    setCreatedKind('competition');
    setLoading(false);
  }, [initialKind]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        resetForm();
      };
    }, [resetForm])
  );

  const togglePeriod = (period: PeriodType) => {
    setSelectedPeriods((prev) => {
      if (prev.includes(period)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== period);
      }
      return [...prev, period];
    });
  };

  const handleCreateCollaboration = async () => {
    if (!title.trim()) {
      showToast('Please enter a collaboration title', 'error');
      return;
    }
    if (!startDate) {
      showToast('Please set a start date', 'error');
      return;
    }
    if (!isContinuous && !endDate) {
      showToast('Please set an end date or enable continuous', 'error');
      return;
    }
    if (!isContinuous && endDate && endDate < startDate) {
      showToast('End date must be after start date', 'error');
      return;
    }
    if (!unitLabel.trim()) {
      showToast('Please enter a unit label', 'error');
      return;
    }

    const effectiveGoalMode: GoalMode = isContinuous ? 'periodic' : goalMode;
    if (effectiveGoalMode === 'periodic' && selectedPeriods.length === 0) {
      showToast('Select at least one goal period', 'error');
      return;
    }

    if (!user) return;
    setLoading(true);

    let parsedOverallTarget: number | null = null;
    if (effectiveGoalMode === 'overall' && overallTarget.trim()) {
      const val = parseFloat(overallTarget);
      if (isNaN(val) || val <= 0) {
        showToast('Enter a valid overall target', 'error');
        setLoading(false);
        return;
      }
      parsedOverallTarget = val;
    }

    const { data: collab, error: collabError } = await supabase
      .from('collaborations')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        creator_id: user.id,
        start_date: startDate,
        end_date: isContinuous ? null : endDate,
        unit_label: unitLabel.trim(),
        icon,
        color,
        goal_mode: effectiveGoalMode,
        overall_target_value: effectiveGoalMode === 'overall' ? parsedOverallTarget : null,
      })
      .select()
      .single();

    if (collabError || !collab) {
      showToast('Failed to create collaboration', 'error');
      setLoading(false);
      return;
    }

    if (effectiveGoalMode === 'periodic') {
      const periodRows = selectedPeriods.map((period_type) => {
        const targetStr = periodTargets[period_type].trim();
        let target_value: number | null = null;
        if (targetStr) {
          const val = parseFloat(targetStr);
          if (!isNaN(val) && val > 0) target_value = val;
        }
        return {
          collaboration_id: collab.id,
          period_type,
          target_value,
        };
      });

      const { error: periodError } = await supabase
        .from('collaboration_goal_periods')
        .insert(periodRows);

      if (periodError) {
        showToast('Collaboration created, but goal periods failed', 'error');
        setLoading(false);
        return;
      }
    }

    const { error: memberError } = await supabase.from('collaboration_members').insert({
      collaboration_id: collab.id,
      user_id: user.id,
    });

    if (memberError) {
      showToast('Collaboration created, but failed to join', 'error');
      setLoading(false);
      return;
    }

    setLoading(false);
    setCreatedKind('collaboration');
    setCreatedCode(collab.join_code);
    showToast('Collaboration created!', 'success');
  };

  const handleCreate = async () => {
    if (createKind === 'collaboration') {
      await handleCreateCollaboration();
      return;
    }
    if (!title.trim()) {
      showToast('Please enter a competition title', 'error');
      return;
    }
    if (!startDate || !endDate) {
      showToast('Please set both start and end dates', 'error');
      return;
    }
    if (endDate < startDate) {
      showToast('End date must be after start date', 'error');
      return;
    }
    if (SCORING_MODES[scoringMode].requiresUnit && !unitLabel.trim()) {
      showToast('Please enter a unit label for this scoring mode', 'error');
      return;
    }
    let parsedScoreLimit: number | null = null;
    if (scoringMode === 'cumulative_low' && useDailyLimit) {
      const limit = parseFloat(scoreLimit);
      if (!scoreLimit.trim() || isNaN(limit) || limit <= 0) {
        showToast('Please enter a valid daily limit greater than 0', 'error');
        return;
      }
      parsedScoreLimit = limit;
    }
    if (!user) return;

    setLoading(true);

    const resolvedUnit = unitLabel.trim() || null;

    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .insert({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        creator_id: user.id,
        scoring_mode: scoringMode,
        unit_label: resolvedUnit,
        score_limit: parsedScoreLimit,
        description: description.trim() || null,
        icon,
        color,
      })
      .select()
      .single();

    if (compError) {
      showToast('Failed to create competition', 'error');
      setLoading(false);
      return;
    }

    const { error: partError } = await supabase.from('participants').insert({
      competition_id: competition.id,
      user_id: user.id,
      score: 0,
    });

    if (partError) {
      showToast('Competition created, but failed to join', 'error');
      setLoading(false);
      return;
    }

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'competition_created',
      event_data: {
        competition_id: competition.id,
        title: title.trim(),
        scoring_mode: scoringMode,
      },
    });

    setLoading(false);
    setCreatedKind('competition');
    setCreatedCode(competition.join_code);
    showToast('Competition created!', 'success');
  };

  const handleCopyCode = async () => {
    if (!createdCode) return;
    try {
      await Clipboard.setStringAsync(createdCode);
      showToast('Join code copied!', 'success');
    } catch {
      showToast('Could not copy code', 'error');
    }
  };

  const handleDone = () => {
    setCreatedCode(null);
    router.replace(
      createdKind === 'collaboration' ? '/(tabs)?section=collaborations' : '/(tabs)',
    );
  };

  if (createdCode) {
    const isCollab = createdKind === 'collaboration';
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDone} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isCollab ? 'Collaboration Created!' : 'Competition Created!'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: colorSet[100] }]}>
            <CompetitionIcon icon={icon} size={36} colorSet={colorSet} />
          </View>
          <Text style={styles.successTitle}>All set!</Text>
          <Text style={styles.successSubtitle}>
            Share this code with friends so they can join your {isCollab ? 'collaboration' : 'challenge'}
          </Text>

          <View style={[styles.codeCard, { borderColor: colorSet[200] }]}>
            <Text style={styles.codeLabel}>Join Code</Text>
            <Text style={[styles.codeText, { color: colorSet[600] }]}>{createdCode}</Text>
          </View>

          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: colorSet[500] }]}
            onPress={handleCopyCode}
          >
            <Copy size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Copy Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={[styles.doneButtonText, { color: colorSet[600] }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!createKind) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.typePickerContent}>
          <Text style={styles.sectionTitle}>What would you like to create?</Text>
          <Text style={styles.sectionSubtitle}>
            Compete against friends or collaborate on shared goals
          </Text>
          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => setCreateKind('competition')}
            activeOpacity={0.7}
          >
            <View style={[styles.typeIcon, { backgroundColor: Colors.primary[100] }]}>
              <Trophy size={28} color={Colors.primary[600]} />
            </View>
            <Text style={styles.typeCardTitle}>Competition</Text>
            <Text style={styles.typeCardSubtitle}>
              Timed challenge with scoring modes and a winner
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.typeCard}
            onPress={() => {
              setCreateKind('collaboration');
              setIcon('activity');
              setColor('teal');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.typeIcon, { backgroundColor: Colors.teal[100] }]}>
              <Handshake size={28} color={Colors.teal[600]} />
            </View>
            <Text style={styles.typeCardTitle}>Collaboration</Text>
            <Text style={styles.typeCardSubtitle}>
              Group goals with weekly, monthly, or yearly tracking
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isCollabForm = createKind === 'collaboration';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isCollabForm ? 'New Collaboration' : 'New Competition'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.iconSection}>
          <View style={[styles.iconContainer, { backgroundColor: colorSet[100] }]}>
            <CompetitionIcon icon={icon} size={36} colorSet={colorSet} />
          </View>
          <Text style={styles.sectionTitle}>
            {isCollabForm ? 'Create a Collaboration' : 'Create a Challenge'}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {isCollabForm
              ? 'Set group goals and track contributions together'
              : 'Pick an icon and color, then choose how scoring works'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {COMPETITION_COLOR_ORDER.map((c) => {
                const swatch = COMPETITION_COLORS[c];
                const selected = color === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: swatch[500] },
                      selected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setColor(c)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${c} color`}
                  />
                );
              })}
              <TouchableOpacity
                style={[
                  styles.colorSwatch,
                  styles.customColorSwatch,
                  customColorSelected && styles.colorSwatchSelected,
                ]}
                onPress={() => setColorPickerVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Custom color"
              >
                {customColorSelected ? (
                  <View style={[styles.customColorFill, { backgroundColor: colorSet[500] }]} />
                ) : (
                  <LinearGradient
                    colors={['#EF4444', '#F97316', '#22C55E', '#3B82F6', '#A855F7', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.customColorFill}
                  />
                )}
                <View style={styles.customColorIcon}>
                  <Pipette size={14} color={colors.text} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <ColorPickerModal
            visible={colorPickerVisible}
            value={color}
            onClose={() => setColorPickerVisible(false)}
            onSelect={setColor}
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.iconRow}>
                  {row.map((iconName) => {
                    const selected = iconName === icon;
                    return (
                      <TouchableOpacity
                        key={iconName}
                        style={[
                          styles.iconOption,
                          selected && {
                            backgroundColor: colorSet[100],
                            borderColor: colorSet[500],
                          },
                        ]}
                        onPress={() => setIcon(iconName)}
                        activeOpacity={0.7}
                      >
                        <CompetitionIcon icon={iconName} size={18} colorSet={colorSet} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {!isCollabForm && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Scoring Mode</Text>
            {(Object.keys(SCORING_MODES) as ScoringMode[]).map((mode) => {
              const cfg = SCORING_MODES[mode];
              const selected = mode === scoringMode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.modeCard,
                    selected && {
                      backgroundColor: colorSet[50],
                      borderColor: colorSet[500],
                    },
                  ]}
                  onPress={() => {
                    setScoringMode(mode);
                    if (mode !== 'cumulative_low') {
                      setUseDailyLimit(false);
                      setScoreLimit('');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeLabel, selected && { color: colorSet[700] }]}>
                    {cfg.label}
                  </Text>
                  <Text style={styles.modeSubtitle}>{cfg.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          )}

          {(isCollabForm || SCORING_MODES[scoringMode].requiresUnit || scoringMode === 'daily') && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Unit Label{!isCollabForm && scoringMode === 'daily' ? ' (optional)' : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={unitLabel}
                onChangeText={setUnitLabel}
                placeholder={
                  isCollabForm
                    ? 'e.g. km, pages, glasses'
                    : scoringMode === 'daily'
                      ? 'e.g. pages — leave blank for check-in only'
                      : 'e.g. pages, glasses, km, hr'
                }
                placeholderTextColor={Colors.neutral[400]}
                maxLength={20}
              />
              {!isCollabForm && (
              <Text style={styles.hint}>
                {scoringMode === 'daily'
                  ? 'Optional — track a daily amount while scoring by streak'
                  : 'Shown when logging and on the leaderboard. Use hr or min for time-based logging.'}
              </Text>
              )}
            </View>
          )}

          {!isCollabForm && scoringMode === 'cumulative_low' && (
            <>
              <View style={styles.limitRow}>
                <View style={styles.limitRowText}>
                  <Text style={styles.label}>Daily limit</Text>
                  <Text style={styles.hint}>
                    Score points for staying under a daily cap — highest total wins
                  </Text>
                </View>
                <Switch
                  value={useDailyLimit}
                  onValueChange={(enabled) => {
                    setUseDailyLimit(enabled);
                    if (!enabled) setScoreLimit('');
                  }}
                  trackColor={{ false: Colors.neutral[300], true: colorSet[400] }}
                  thumbColor={useDailyLimit ? colorSet[600] : Colors.surface}
                />
              </View>
              {useDailyLimit && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Limit</Text>
                  <TextInput
                    style={styles.input}
                    value={scoreLimit}
                    onChangeText={setScoreLimit}
                    placeholder={
                      unitLabel.trim()
                        ? `e.g. 2 ${unitLabel.trim()}`
                        : 'e.g. 2'
                    }
                    placeholderTextColor={Colors.neutral[400]}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.hint}>
                    Each day earns max(0, limit − logged amount) points. Over the limit or no log = 0.
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {isCollabForm ? 'Collaboration Title' : 'Competition Title'}
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Drink 8 glasses of water daily"
              placeholderTextColor={Colors.neutral[400]}
              maxLength={60}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What are the rules or goals for this challenge?"
              placeholderTextColor={Colors.neutral[400]}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {isCollabForm && (
            <>
              <View style={styles.limitRow}>
                <View style={styles.limitRowText}>
                  <Text style={styles.label}>Continuous</Text>
                  <Text style={styles.hint}>No end date — track goals over time</Text>
                </View>
                <Switch
                  value={isContinuous}
                  onValueChange={(enabled) => {
                    setIsContinuous(enabled);
                    if (enabled) {
                      setEndDate('');
                      setGoalMode('periodic');
                    }
                  }}
                  trackColor={{ false: Colors.neutral[300], true: colorSet[400] }}
                  thumbColor={isContinuous ? colorSet[600] : Colors.surface}
                />
              </View>

              {!isContinuous && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Goal Type</Text>
                  <TouchableOpacity
                    style={[
                      styles.modeCard,
                      goalMode === 'overall' && {
                        backgroundColor: colorSet[50],
                        borderColor: colorSet[500],
                      },
                    ]}
                    onPress={() => setGoalMode('overall')}
                  >
                    <Text style={styles.modeLabel}>Overall goal</Text>
                    <Text style={styles.modeSubtitle}>One target for the entire date range</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeCard,
                      goalMode === 'periodic' && {
                        backgroundColor: colorSet[50],
                        borderColor: colorSet[500],
                      },
                    ]}
                    onPress={() => setGoalMode('periodic')}
                  >
                    <Text style={styles.modeLabel}>Periodic goals</Text>
                    <Text style={styles.modeSubtitle}>Weekly, monthly, and/or yearly targets</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(isContinuous || goalMode === 'periodic') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Goal Periods</Text>
                  {PERIOD_TYPES.map((period) => {
                    const selected = selectedPeriods.includes(period);
                    return (
                      <View key={period}>
                        <TouchableOpacity
                          style={[
                            styles.modeCard,
                            selected && {
                              backgroundColor: colorSet[50],
                              borderColor: colorSet[500],
                            },
                          ]}
                          onPress={() => togglePeriod(period)}
                        >
                          <Text style={[styles.modeLabel, selected && { color: colorSet[700] }]}>
                            {PERIOD_LABELS[period]}
                          </Text>
                        </TouchableOpacity>
                        {selected && (
                          <TextInput
                            style={[styles.input, { marginTop: Spacing.xs, marginBottom: Spacing.sm }]}
                            value={periodTargets[period]}
                            onChangeText={(text) =>
                              setPeriodTargets((prev) => ({ ...prev, [period]: text }))
                            }
                            placeholder={`Optional target per ${period.replace('ly', '')} (e.g. 500)`}
                            placeholderTextColor={Colors.neutral[400]}
                            keyboardType="decimal-pad"
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {!isContinuous && goalMode === 'overall' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Overall Target (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={overallTarget}
                    onChangeText={setOverallTarget}
                    placeholder="e.g. 1000"
                    placeholderTextColor={Colors.neutral[400]}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </>
          )}

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                minDate={today}
              />
            </View>
            {!isCollabForm || !isContinuous ? (
            <View style={styles.dateField}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                minDate={startDate || today}
                maxDate={maxEndDateStr}
              />
            </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              loading && styles.buttonDisabled,
              { backgroundColor: colorSet[500] },
            ]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isCollabForm ? 'Create Collaboration' : 'Create Competition'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  iconSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: colors.text,
  },
  customColorSwatch: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customColorFill: {
    ...StyleSheet.absoluteFillObject,
  },
  customColorIcon: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrid: {
    gap: ICON_GAP,
  },
  iconRow: {
    flexDirection: 'row',
    gap: ICON_GAP,
  },
  iconOption: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  modeLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  modeSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
    lineHeight: 16,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  limitRowText: {
    flex: 1,
    gap: 2,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateField: {
    flex: 1,
  },
  button: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontSize: FontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  codeCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderWidth: 2,
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  codeText: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    letterSpacing: 3,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    marginBottom: Spacing.md,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  doneButton: {
    paddingVertical: Spacing.md,
  },
  doneButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  typePickerContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  typeCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: Spacing.sm,
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  typeCardTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  typeCardSubtitle: {
    fontSize: FontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
}
