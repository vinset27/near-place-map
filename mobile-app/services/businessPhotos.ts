/**
 * Business photo upload flow (same as web):
 * 1) POST /api/business/photos/presign -> returns { putUrl, publicUrl }
 * 2) PUT file bytes to putUrl
 * 3) send publicUrl in /api/business/apply photos[]
 */

import api from './api';
// Expo SDK 54+: uploadAsync/copyAsync are deprecated on the main module.
// Use the legacy module to keep the same behavior without warnings.
import * as FileSystem from 'expo-file-system/legacy';

export type PresignResponse = {
  putUrl: string;
  publicUrl: string;
};

export async function presignBusinessPhoto(params: {
  fileName: string;
  contentType: string;
}): Promise<PresignResponse> {
  const res = await api.post('/api/business/photos/presign', params);
  const data = res.data as any;
  // Backward/forward compatible: some backends return { url }, others { putUrl }.
  const putUrl = String(data?.putUrl || data?.url || '');
  const publicUrl = String(data?.publicUrl || '');
  if (!putUrl) throw new Error("Upload: URL de téléversement manquante (putUrl/url).");
  if (!publicUrl) throw new Error("Upload: URL publique manquante. Configure R2_PUBLIC_BASE_URL (ou utilise le backend avec /api/business/photos/public/:key).");
  return { putUrl, publicUrl };
}

export async function uploadToPresignedPutUrl(params: {
  putUrl: string;
  localUri: string;
  contentType: string;
}): Promise<void> {
  // Stream upload (prevents loading large videos into memory).
  // Android may return content:// URIs from pickers; uploadAsync is more reliable with file://
  let src = params.localUri;
  let didTempCopy = false;
  let tmpPath: string | null = null;
  try {
    if (src.startsWith('content://')) {
      const ext =
        params.contentType.includes('png') ? '.png' : params.contentType.includes('webp') ? '.webp' : params.contentType.includes('mp4') ? '.mp4' : '.bin';
      tmpPath = `${FileSystem.cacheDirectory || ''}np-upload-${Date.now()}${ext}`;
      await FileSystem.copyAsync({ from: src, to: tmpPath });
      src = tmpPath;
      didTempCopy = true;
    }

    // Some Expo SDKs expose upload types under different names.
    const uploadType =
      (FileSystem as any)?.FileSystemUploadType?.BINARY_CONTENT ??
      (FileSystem as any)?.FileSystemUploadType?.Binary_Content ??
      (FileSystem as any)?.FileSystemUploadType?.binary_content ??
      (FileSystem as any)?.FileSystemUploadType?.BINARY ??
      (FileSystem as any)?.FileSystemUploadType?.BINARYCONTENT ??
      (FileSystem as any)?.FileSystemUploadType?.BINARYCONTENT ??
      (FileSystem as any)?.FileSystemUploadType?.BINARY_CONTENT;

    const res = await FileSystem.uploadAsync(params.putUrl, src, {
      httpMethod: 'PUT',
      headers: { 'Content-Type': params.contentType },
      ...(uploadType ? { uploadType } : {}),
    });
    if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (status=${res.status})`);
  } finally {
    if (didTempCopy && tmpPath) {
      await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
    }
  }
}


