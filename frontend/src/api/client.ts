import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  TripDetail,
  TripSummary,
  PaginatedResponse,
  TripCreatePayload,
} from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

/* ---- hooks ---- */

export function useTrips() {
  return useQuery<PaginatedResponse<TripSummary>>({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data } = await api.get("/api/trips/");
      return data;
    },
  });
}

export function useTrip(id: string | undefined) {
  return useQuery<TripDetail>({
    queryKey: ["trips", id],
    queryFn: async () => {
      const { data } = await api.get(`/api/trips/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation<TripDetail, Error, TripCreatePayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post("/api/trips/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await api.delete(`/api/trips/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}
