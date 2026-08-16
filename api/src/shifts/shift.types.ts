export type GeoPoint = { lat: number; lng: number };

export type Brand = { id: string; name: string };

export type Branch = { id: string; name: string; location: GeoPoint };

export type Shift = {
  id: string;
  userId: string;
  brand: Brand;
  branch: Branch;
  startDate: string;
  endDate: string;
  startedAt: string | null;
  finishedAt: string | null;
  startedAtLocation: GeoPoint | null;
  finishedAtLocation: GeoPoint | null;
};

export type Break = {
  id: string;
  shiftId: string;
  startedAt: string;
  endedAt: string | null;
};
