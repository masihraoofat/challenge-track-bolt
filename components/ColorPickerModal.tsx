import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { COMPETITION_COLORS, isPresetColor } from '@/constants/competition';
import { buildColorSetFromHex, hexToHue, hueToHex, isCustomHexColor } from '@/lib/colorUtils';

interface ColorPickerModalProps {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (color: string) => void;
}

const SPECTRUM_COLORS = [
  '#FF0000',
  '#FF7F00',
  '#FFFF00',
  '#00FF00',
  '#00FFFF',
  '#0000FF',
  '#8B00FF',
  '#FF00FF',
  '#FF0000',
] as const;

const THUMB_SIZE = 28;

function resolveInitialHue(value: string): number {
  if (isCustomHexColor(value)) {
    return hexToHue(value);
  }
  if (isPresetColor(value)) {
    return hexToHue(COMPETITION_COLORS[value][500]);
  }
  return 30;
}

export function ColorPickerModal({ visible, value, onClose, onSelect }: ColorPickerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hue, setHue] = useState(30);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setHue(resolveInitialHue(value));
    }
  }, [visible, value]);

  const selectedHex = hueToHex(hue);
  const previewSet = buildColorSetFromHex(selectedHex) ?? buildColorSetFromHex('#F97316')!;

  const updateHueFromX = (x: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const clamped = Math.max(0, Math.min(width, x));
    setHue((clamped / width) * 360);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => updateHueFromX(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => updateHueFromX(evt.nativeEvent.locationX),
      }),
    [],
  );

  const thumbLeft =
    trackWidth > 0
      ? Math.max(0, Math.min(trackWidth - THUMB_SIZE, (hue / 360) * trackWidth - THUMB_SIZE / 2))
      : 0;

  const handleDone = () => {
    onSelect(selectedHex);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close color picker" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Pick a Color</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewRow}>
            <View style={[styles.previewSwatch, { backgroundColor: previewSet[500] }]}>
              <View style={[styles.previewInner, { backgroundColor: previewSet[100] }]} />
            </View>
            <View style={styles.previewTextGroup}>
              <Text style={styles.previewLabel}>Selected</Text>
              <Text style={[styles.previewHex, { color: previewSet[700] }]}>{selectedHex}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Color spectrum</Text>
          <View
            style={styles.spectrumWrap}
            onLayout={(e) => {
              const width = e.nativeEvent.layout.width;
              trackWidthRef.current = width;
              setTrackWidth(width);
            }}
            {...panResponder.panHandlers}
          >
            <LinearGradient
              colors={SPECTRUM_COLORS}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.spectrumBar}
            />
            <View
              style={[
                styles.spectrumThumb,
                {
                  left: thumbLeft,
                  backgroundColor: previewSet[500],
                },
              ]}
            />
          </View>
          <Text style={styles.hint}>Slide along the spectrum to choose any color</Text>

          <TouchableOpacity style={[styles.doneButton, { backgroundColor: previewSet[500] }]} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Use This Color</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  previewSwatch: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInner: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
  },
  previewTextGroup: {
    gap: 2,
  },
  previewLabel: {
    fontSize: FontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewHex: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: Spacing.sm,
  },
  spectrumWrap: {
    height: 48,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  spectrumBar: {
    height: 32,
    borderRadius: BorderRadius.full,
  },
  spectrumThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  doneButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
});
}
