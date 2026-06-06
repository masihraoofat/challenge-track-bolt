import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { ArrowLeft, BookOpen, Share, Copy } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

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
    if (!user) return;

    setLoading(true);

    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .insert({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        creator_id: user.id,
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
      event_data: { competition_id: competition.id, title: title.trim() },
    });

    setLoading(false);
    setCreatedCode(competition.join_code);
    showToast('Competition created!', 'success');
  };

  const handleCopyCode = async () => {
    if (!createdCode) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(createdCode);
        showToast('Join code copied!', 'success');
      }
    } catch {
      showToast('Could not copy code', 'error');
    }
  };

  if (createdCode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Competition Created!</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <BookOpen size={40} color={Colors.success[600]} />
          </View>
          <Text style={styles.successTitle}>All set!</Text>
          <Text style={styles.successSubtitle}>
            Share this code with friends so they can join your reading challenge
          </Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Join Code</Text>
            <Text style={styles.codeText}>{createdCode}</Text>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleCopyCode}>
            <Copy size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Copy Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Competition</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.iconSection}>
          <View style={styles.iconContainer}>
            <BookOpen size={36} color={Colors.primary[600]} />
          </View>
          <Text style={styles.sectionTitle}>Create a Reading Challenge</Text>
          <Text style={styles.sectionSubtitle}>
            Set up a competition and invite friends to join your reading streak
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Competition Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Read 20 pages a day"
              placeholderTextColor={Colors.neutral[400]}
              maxLength={60}
            />
            <Text style={styles.hint}>Describe the daily reading goal</Text>
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
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
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
    backgroundColor: Colors.primary[100],
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
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.neutral[400],
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateField: {
    flex: 1,
  },
  button: {
    backgroundColor: Colors.primary[500],
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
    backgroundColor: Colors.success[100],
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
    borderColor: Colors.primary[200],
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
    color: Colors.primary[600],
    letterSpacing: 3,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[500],
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
    color: Colors.primary[600],
    fontWeight: '600',
  },
});
