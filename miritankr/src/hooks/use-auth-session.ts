import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/auth-store";

export function useAuthSession() {
  const store = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return {
    user: isReady ? store.user : null,
    token: isReady ? store.token : null,
    isLoggedIn: isReady ? store.isLoggedIn : false,
    setAuth: store.setAuth,
    clearAuth: store.clearAuth,
    isReady,
  };
}
