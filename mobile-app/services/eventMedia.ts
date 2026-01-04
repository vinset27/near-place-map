import api from './api';
import { uploadToPresignedPutUrl } from './businessPhotos';

export type PresignEventMediaResponse = {
  putUrl: string;
  publicUrl: string | null;
  key?: string;
};

export async function presignEventMedia(params: { fileName: string; contentType: string }): Promise<PresignEventMediaResponse> {
  const res = await api.post('/api/events/media/presign', params);
  return res.data as PresignEventMediaResponse;
}

export async function uploadEventMedia(params: { localUri: string; contentType: string; fileName: string }) {
  const presigned = await presignEventMedia({ fileName: params.fileName, contentType: params.contentType });
  await uploadToPresignedPutUrl({ putUrl: presigned.putUrl, localUri: params.localUri, contentType: params.contentType });
  if (!presigned.publicUrl) throw new Error('Upload ok but publicUrl missing (R2_PUBLIC_BASE_URL?)');
  return presigned.publicUrl;
}


