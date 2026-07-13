import type {
  ReflectionSegment,
  ReflectionSession,
  ReflectionSessionsResponse,
  SegmentMetadataInput,
} from '../../types/oracleReflection';
import type { PendingReflection } from './reflectionOutbox';

export class ReflectionApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ReflectionApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new ReflectionApiError(response.status, message);
  }
  return body as T;
}

export const getReflectionCapability = () => request<{ ok: true; admin: true }>('/api/oracle/reflections/capability');

export async function createReflectionSession(id: string, hexagramNumber: number): Promise<ReflectionSession> {
  const body = await request<{ session: ReflectionSession }>('/api/oracle/reflections/sessions', {
    method: 'POST', body: JSON.stringify({ id, hexagramNumber }),
  });
  return body.session;
}

export const listReflectionSessions = (hexagramNumber: number) =>
  request<ReflectionSessionsResponse>(`/api/oracle/reflections/sessions?hexagram=${encodeURIComponent(hexagramNumber)}`);

export async function uploadReflectionSegment(value: PendingReflection): Promise<ReflectionSegment> {
  const { blob, ...metadata } = value;
  const form = new FormData();
  form.set('metadata', JSON.stringify(metadata satisfies SegmentMetadataInput));
  form.set('audio', blob, `${value.id}.${value.mimeType.includes('mp4') ? 'm4a' : 'webm'}`);
  const body = await request<{ segment: ReflectionSegment }>('/api/oracle/reflections/segments', { method: 'POST', body: form });
  return body.segment;
}

export const listReflectionSegments = async (sessionId: string) => {
  const body = await request<{ segments: ReflectionSegment[] }>(`/api/oracle/reflections/segments?sessionId=${encodeURIComponent(sessionId)}`);
  return body.segments;
};

export const transcribeReflectionSegment = async (id: string) => {
  const body = await request<{ segment: ReflectionSegment }>(`/api/oracle/reflections/segments/${encodeURIComponent(id)}/transcribe`, { method: 'POST' });
  return body.segment;
};

export const updateReflectionTranscript = async (id: string, transcript: string) => {
  const body = await request<{ segment: ReflectionSegment }>(`/api/oracle/reflections/segments/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ transcript }),
  });
  return body.segment;
};

export const reorderReflectionSegments = async (sessionId: string, segmentIds: string[]) => {
  const body = await request<{ segments: ReflectionSegment[] }>('/api/oracle/reflections/segments/order', {
    method: 'PUT', body: JSON.stringify({ sessionId, segmentIds }),
  });
  return body.segments;
};
