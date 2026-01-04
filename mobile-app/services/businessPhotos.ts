/**
 * Business photo upload flow (same as web):
 * 1) POST /api/business/photos/presign -> returns { putUrl, publicUrl }
 * 2) PUT file bytes to putUrl
 * 3) send publicUrl in /api/business/apply photos[]
 */

import api from './api';
import * as FileSystem from 'expo-file-system';

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
  // Stream upload (prevents loading large videos into memory).
  const res = await FileSystem.uploadAsync(params.putUrl, params.localUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': params.contentType },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (status=${res.status})`);
}


