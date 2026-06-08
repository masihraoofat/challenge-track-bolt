import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, FontSizes } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.text}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  text: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  link: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
  },
  linkText: {
    fontSize: FontSizes.md,
    color: Colors.primary[600],
    fontWeight: '600',
  },
});
