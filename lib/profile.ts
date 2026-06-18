import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

const BIO_MAX_LENGTH = 280;

export { BIO_MAX_LENGTH };

interface UploadAsset {
  uri: string;
  mimeType?: string | null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

async function readAssetBytes(uri: string): Promise<ArrayBuffer> {
  const file = new File(uri);
  return file.arrayBuffer();
}

export async function uploadAvatar(
  userId: string,
  asset: UploadAsset,
): Promise<{ url: string | null; error: string | null }> {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = extensionForMimeType(mimeType);
  const filePath = `${userId}/avatar.${ext}`;

  try {
    const bytes = await readAssetBytes(asset.uri);

    await supabase.storage.from('avatars').remove([
      `${userId}/avatar.jpg`,
      `${userId}/avatar.png`,
      `${userId}/avatar.webp`,
      `${userId}/avatar.gif`,
    ]);

    const { error } = await supabase.storage.from('avatars').upload(filePath, bytes, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return { url: null, error: message };
  }
}

export async function updateUserProfile(
  userId: string,
  updates: { bio?: string | null; avatar_url?: string | null },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'Profile not found. Try signing out and back in.' };
  return { error: null };
}
