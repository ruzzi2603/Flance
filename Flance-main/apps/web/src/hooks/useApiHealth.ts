"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiHealth } from "../services/api";

export function useApiHealth() {
  return useQuery({
    queryKey: ["api-health"],
    queryFn: getApiHealth,
  });
}
