import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  opacity: Animated.Value;
}

let toastId = 0;
let addToastFn: ((message: string, type: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = 'success') {
  addToastFn?.(message, type);
}

export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    const opacity = new Animated.Value(0);
    const newToast = { id, message, type, opacity };
    setToasts((prev) => [...prev, newToast]);

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case 'success': return Colors.success[600];
      case 'error': return Colors.error[500];
      case 'info': return Colors.primary[600];
    }
  };

  return (
    <View style={[styles.container, { top: insets.top + Spacing.md }]} pointerEvents="none">
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          style={[styles.toast, { backgroundColor: getBgColor(toast.type), opacity: toast.opacity }]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
