import type { GeoPoint } from './shift.types';

// Shape/format validation (ISO date, lat/lng ranges) happens in the ValidationPipe via
// ShiftActionDto - these just convert already-validated fields for the business rules.
export function toDate(datetime?: string): Date {
  return datetime ? new Date(datetime) : new Date();
}

export function toGeoPoint(location?: { lat: number; lng: number }): GeoPoint | null {
  return location ? { lat: location.lat, lng: location.lng } : null;
}

export function resolveUserId(body: unknown, query: unknown, defaultUserId: string): string {
  const bodyUserId = (body as Record<string, unknown> | undefined)?.userId;
  const queryUserId = (query as Record<string, unknown> | undefined)?.userId;
  return (bodyUserId as string) || (queryUserId as string) || defaultUserId;
}
