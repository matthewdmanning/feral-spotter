import { authProvider } from "@/src/lib/auth";
import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "./IAuthProvider";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => authProvider.onAuthStateChanged(setUser), []);

  const signIn = useCallback(() => authProvider.signIn(), []);
  const signOut = useCallback(() => authProvider.signOut(), []);

  return { user, isAuthenticated: user !== null, signIn, signOut };
}
