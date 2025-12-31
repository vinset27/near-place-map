/**
 * Business photo upload flow (same as web):
 * 1) POST /api/business/photos/presign -> returns { putUrl, publicUrl }
 * 2) PUT file bytes to putUrl
 * 3) send publicUrl in /api/business/apply photos[]
 */

import api from './api';

export type PresignResponse = {
  putUrl: string;
  publicUrl: string;
};

export async function presignBusinessPhoto(params: {
  fileName: string;
  contentType: string;
}): Promise<PresignResponse> {
  const res = await api.post('/api/business/photos/presign', params);
  return res.data as PresignResponse;
}

export async function uploadToPresignedPutUrl(params: {
  putUrl: string;
  localUri: string;
  contentType: string;
}): Promise<void> {
  // Avoid expo-file-system (was causing Metro resolution error on iOS).
  // Expo/RN supports fetching file:// URIs -> Blob in most cases for ImagePicker output.
  const fileRes = await fetch(params.localUri);
  const blob = await fileRes.blob();

  const res = await fetch(params.putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': params.contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (status=${res.status})`);
}


