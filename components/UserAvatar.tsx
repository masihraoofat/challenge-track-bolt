import { View, Image, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { Colors, BorderRadius } from '@/constants/theme';

interface UserAvatarProps {
  avatarUrl?: string | null;
  size?: number;
}

export function UserAvatar({ avatarUrl, size = 80 }: UserAvatarProps) {
  const iconSize = Math.round(size * 0.5);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <User size={iconSize} color={Colors.primary[600]} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: Colors.primary[100],
  },
  placeholder: {
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
