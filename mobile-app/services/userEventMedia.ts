import api from './api';
import { uploadToPresignedPutUrl } from './businessPhotos';

export type PresignUserEventMediaResponse = {
  putUrl: string;
  publicUrl: string | null;
  key?: string;
};

export async function presignUserEventMedia(params: { fileName: string; contentType: string }): Promise<PresignUserEventMediaResponse> {
  const res = await api.post('/api/user-events/media/presign', params);
  const data = res.data as any;
  // Backward/forward compatible: some backends may return { url } instead of { putUrl }.
  const putUrl = String(data?.putUrl || data?.url || '');
  const publicUrl = data?.publicUrl != null ? String(data.publicUrl) : null;
  const key = data?.key != null ? String(data.key) : undefined;
  if (!putUrl) {
    throw new Error("Upload: URL de téléversement manquante (putUrl/url). Vérifie que le backend est bien redéployé.");
  }
  return { putUrl, publicUrl, key };
}

export async function uploadUserEventPhoto(params: { localUri: string; contentType: string; fileName: string }): Promise<string> {
  const presigned = await presignUserEventMedia({ fileName: params.fileName, contentType: params.contentType });
  if (!presigned.putUrl) throw new Error("Upload: URL signée manquante.");
  await uploadToPresignedPutUrl({ putUrl: presigned.putUrl, localUri: params.localUri, contentType: params.contentType });
  if (!presigned.publicUrl) throw new Error('Upload OK mais URL publique manquante.');
  return presigned.publicUrl;
}


