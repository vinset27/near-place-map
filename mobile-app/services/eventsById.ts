import api from './api';
import type { ApiEvent } from './events';

export async function fetchEventById(id: string): Promise<ApiEvent> {
  const res = await api.get('/api/events/' + encodeURIComponent(id));
  return (res.data as any)?.event as ApiEvent;
}







