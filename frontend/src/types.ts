export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export interface Stop {
  id: number;
  sequence: number;
  kind: "start" | "pickup" | "dropoff" | "fuel" | "break" | "rest" | "end" | "drive";
  duty_status: "off" | "sb" | "driving" | "on";
  label: string;
  lat: number | null;
  lng: number | null;
  arrive_min: number;
  depart_min: number;
  miles_so_far: number;
}

export interface LogSegment {
  status: "off" | "sb" | "driving" | "on";
  start_min: number;
  end_min: number;
  label: string;
  kind: string;
}

export interface LogRemark {
  at_min: number;
  text: string;
  kind: string;
}

export interface DailyLog {
  id: number;
  day_index: number;
  start_location: string;
  end_location: string;
  miles_driven: number;
  totals: { off: number; sb: number; driving: number; on: number };
  segments: LogSegment[];
  remarks: LogRemark[];
}

export interface TripDetail {
  id: number;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hrs: string;
  current_coords: GeocodeResult;
  pickup_coords: GeocodeResult;
  dropoff_coords: GeocodeResult;
  total_distance_mi: number;
  total_duration_hrs: number;
  total_driving_hrs: number;
  total_on_duty_hrs: number;
  days_required: number;
  route_geometry: GeoJSON.LineString;
  created_at: string;
  stops: Stop[];
  daily_logs: DailyLog[];
}

export interface TripSummary {
  id: number;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hrs: string;
  total_distance_mi: number;
  total_duration_hrs: number;
  days_required: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TripCreatePayload {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hrs: number;
}
