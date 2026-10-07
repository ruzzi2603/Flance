"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

export function useAuth() {
  const { user, setUser } = useAuthStore();
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });

  useEffect(() => {
    if (query.data?.data) {
      setUser(query.data.data);
      return;
    }

    if (query.isError) {
      setUser(null);
    }
  }, [query.data, query.isError, setUser]);

  return {
    user,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(user),
  };
}

