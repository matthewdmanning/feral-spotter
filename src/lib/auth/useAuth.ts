import { authProvider } from "@/src/lib/auth";
import { useAuthStore } from "@/src/lib/auth/authStore";
import { useCallback } from "react";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isReady = useAuthStore((s) => s.isReady);

  const signIn = useCallback(() => authProvider.signIn(), []);
  const signOut = useCallback(() => authProvider.signOut(), []);

  return { user, isAuthenticated: user !== null, isReady, signIn, signOut };
}
