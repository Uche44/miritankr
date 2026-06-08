import { useAuthStore } from "../stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  json?: any;
}

export async function apiFetch<T = any>(
  path: string, 
  options: RequestOptions = {}
): Promise<T> {
  const { token } = useAuthStore.getState();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.json) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An error occurred";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      // Ignore parser crash
    }
    
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== "undefined") {
        // Only redirect if we are not already on login/register pages to prevent loops
        const pathName = window.location.pathname;
        if (pathName !== "/login" && pathName !== "/register") {
          window.location.href = "/login";
        }
      }
    }
    
    throw new Error(errorDetail);
  }

  // Handle empty or 204 response types
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
