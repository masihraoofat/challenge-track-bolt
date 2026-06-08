import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { ArrowLeft, BookOpen, Copy, Activity, Smartphone, Sparkles } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import {
  CompetitionPreset,
  COMPETITION_PRESETS,
  SCORING_MODES,
  ScoringMode,
  getCompetitionConfig,
} from '@/constants/competition';

const PRESET_ICONS: Record<CompetitionPreset, React.ReactNode> = {
  reading: <BookOpen size={24} color={Colors.primary[600]} />,
  running: <Activity size={24} color={Colors.blue[600]} />,
  screen_time: <Smartphone size={24} color={Colors.teal[600]} />,
  custom: <Sparkles size={24} color={Colors.primary[600]} />,
};

const PRESET_ORDER: CompetitionPreset[] = ['reading', 'running', 'screen_time', 'custom'];

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const createdCodeRef = useRef<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState<CompetitionPreset>('reading');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('daily');
  const [unitLabel, setUnitLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const maxEndDate = new Date();
  maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);
  const maxEndDateStr = maxEndDate.toISOString().split('T')[0];

  useEffect(() => {
    createdCodeRef.current = createdCode;
  }, [createdCode]);
  const presetConfig = COMPETITION_PRESETS[preset];
  const previewConfig = getCompetitionConfig({
    competition_type: preset,
    scoring_mode: scoringMode,
    unit_label: unitLabel.trim() || presetConfig.defaultUnitLabel,
    description: description.trim() || null,
  });

  const applyPreset = (p: CompetitionPreset) => {
    const cfg = COMPETITION_PRESETS[p];
    setPreset(p);
    setScoringMode(cfg.defaultScoringMode);
    setUnitLabel(cfg.defaultUnitLabel || '');
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (createdCodeRef.current !== null) {
          setTitle('');
          setDescription('');
          setStartDate('');
          setEndDate('');
          setPreset('reading');
          setScoringMode('daily');
          setUnitLabel('');
          setCreatedCode(null);
          setLoading(false);
        }
      };
    }, [])
  );

  const handleCreate = async () => {
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
    if (!user) return;

    setLoading(true);

    const resolvedUnit =
      scoringMode === 'daily'
        ? null
        : unitLabel.trim() || presetConfig.defaultUnitLabel || null;

    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .insert({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        creator_id: user.id,
        competition_type: preset,
        scoring_mode: scoringMode,
        unit_label: resolvedUnit,
        description: description.trim() || null,
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
        type: preset,
        scoring_mode: scoringMode,
      },
    });

    setLoading(false);
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
    router.replace('/(tabs)');
  };

  if (createdCode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDone} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Competition Created!</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: previewConfig.colorSet[100] }]}>
            {PRESET_ICONS[preset]}
          </View>
          <Text style={styles.successTitle}>All set!</Text>
          <Text style={styles.successSubtitle}>
            Share this code with friends so they can join your {previewConfig.label.toLowerCase()} challenge
          </Text>

          <View style={[styles.codeCard, { borderColor: previewConfig.colorSet[200] }]}>
            <Text style={styles.codeLabel}>Join Code</Text>
            <Text style={[styles.codeText, { color: previewConfig.colorSet[600] }]}>{createdCode}</Text>
          </View>

          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: previewConfig.colorSet[500] }]}
            onPress={handleCopyCode}
          >
            <Copy size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Copy Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={[styles.doneButtonText, { color: previewConfig.colorSet[600] }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Competition</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.iconSection}>
          <View style={[styles.iconContainer, { backgroundColor: previewConfig.colorSet[100] }]}>
            {PRESET_ICONS[preset]}
          </View>
          <Text style={styles.sectionTitle}>Create a Challenge</Text>
          <Text style={styles.sectionSubtitle}>
            Pick a template, choose how scoring works, and invite friends
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Template</Text>
            <View style={styles.presetGrid}>
              {PRESET_ORDER.map((p) => {
                const cfg = COMPETITION_PRESETS[p];
                const selected = p === preset;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.presetChip,
                      selected && { backgroundColor: cfg.colorSet[100], borderColor: cfg.colorSet[500] },
                    ]}
                    onPress={() => applyPreset(p)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeIcon, selected && { backgroundColor: cfg.colorSet[200] }]}>
                      {PRESET_ICONS[p]}
                    </View>
                    <Text style={[styles.typeLabel, selected && { color: cfg.colorSet[700] }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

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
                      backgroundColor: previewConfig.colorSet[50],
                      borderColor: previewConfig.colorSet[500],
                    },
                  ]}
                  onPress={() => setScoringMode(mode)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeLabel, selected && { color: previewConfig.colorSet[700] }]}>
                    {cfg.label}
                  </Text>
                  <Text style={styles.modeSubtitle}>{cfg.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {SCORING_MODES[scoringMode].requiresUnit && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Unit Label</Text>
              <TextInput
                style={styles.input}
                value={unitLabel}
                onChangeText={setUnitLabel}
                placeholder="e.g. pages, glasses, pushups"
                placeholderTextColor={Colors.neutral[400]}
                maxLength={20}
              />
              <Text style={styles.hint}>Shown when logging and on the leaderboard</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Competition Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={presetConfig.placeholder}
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

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                minDate={today}
              />
            </View>
            <View style={styles.dateField}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                minDate={startDate || today}
                maxDate={maxEndDateStr}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              loading && styles.buttonDisabled,
              { backgroundColor: previewConfig.colorSet[500] },
            ]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Competition</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
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
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
    color: Colors.neutral[700],
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  presetChip: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.neutral[500],
  },
  modeCard: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  modeLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  modeSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[500],
    lineHeight: 16,
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
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  codeCard: {
    backgroundColor: Colors.surface,
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
});
