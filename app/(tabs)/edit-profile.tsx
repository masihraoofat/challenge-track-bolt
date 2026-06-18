import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { UserAvatar } from '@/components/UserAvatar';
import { ArrowLeft, Camera } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { BIO_MAX_LENGTH, uploadAvatar, updateUserProfile } from '@/lib/profile';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
        scrollContent: {
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.xxl,
        },
        avatarSection: {
          alignItems: 'center',
          marginBottom: Spacing.xl,
        },
        avatarButton: {
          position: 'relative',
        },
        cameraBadge: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 32,
          height: 32,
          borderRadius: BorderRadius.full,
          backgroundColor: Colors.primary[500],
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.surface,
        },
        username: {
          fontSize: FontSizes.lg,
          fontWeight: '700',
          color: colors.text,
          marginTop: Spacing.md,
        },
        changePhotoText: {
          fontSize: FontSizes.sm,
          color: Colors.primary[600],
          fontWeight: '600',
          marginTop: Spacing.sm,
        },
        inputGroup: {
          gap: Spacing.xs,
          marginBottom: Spacing.lg,
        },
        label: {
          fontSize: FontSizes.sm,
          fontWeight: '600',
          color: colors.text,
        },
        bioInput: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: BorderRadius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          fontSize: FontSizes.md,
          color: colors.text,
          minHeight: 120,
          textAlignVertical: 'top',
        },
        charCount: {
          fontSize: FontSizes.xs,
          color: colors.textSecondary,
          textAlign: 'right',
        },
        saveButton: {
          backgroundColor: Colors.primary[500],
          borderRadius: BorderRadius.md,
          paddingVertical: Spacing.md + 2,
          alignItems: 'center',
        },
        saveButtonDisabled: {
          opacity: 0.7,
        },
        saveButtonText: {
          color: '#FFFFFF',
          fontSize: FontSizes.lg,
          fontWeight: '700',
        },
        loader: {
          marginTop: Spacing.xxl,
        },
      }),
    [colors],
  );

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('username, bio, avatar_url')
      .eq('id', user.id)
      .single();

    if (error) {
      showToast('Failed to load profile', 'error');
    } else if (data) {
      setUsername(data.username);
      setBio(data.bio ?? '');
      setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const handlePickPhoto = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission is required', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    const { url, error: uploadError } = await uploadAvatar(user.id, {
      uri: asset.uri,
      mimeType: asset.mimeType,
    });
    setUploadingPhoto(false);

    if (!url) {
      showToast(uploadError ?? 'Failed to upload photo', 'error');
      return;
    }

    const { error } = await updateUserProfile(user.id, { avatar_url: url });
    if (error) {
      showToast(error, 'error');
      return;
    }

    setAvatarUrl(url);
    showToast('Photo updated', 'success');
  };

  const handleSave = async () => {
    if (!user) return;

    const trimmedBio = bio.trim();
    if (trimmedBio.length > BIO_MAX_LENGTH) {
      showToast(`Bio must be ${BIO_MAX_LENGTH} characters or less`, 'error');
      return;
    }

    setSaving(true);
    const { error } = await updateUserProfile(user.id, {
      bio: trimmedBio || null,
    });
    setSaving(false);

    if (error) {
      showToast(error, 'error');
      return;
    }

    showToast('Profile saved', 'success');
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary[500]} style={styles.loader} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
          >
            <UserAvatar avatarUrl={avatarUrl} size={96} />
            <View style={styles.cameraBadge}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.username}>{username}</Text>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
            <Text style={styles.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others a little about yourself..."
            placeholderTextColor={Colors.neutral[400]}
            multiline
            maxLength={BIO_MAX_LENGTH}
          />
          <Text style={styles.charCount}>
            {bio.length}/{BIO_MAX_LENGTH}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
