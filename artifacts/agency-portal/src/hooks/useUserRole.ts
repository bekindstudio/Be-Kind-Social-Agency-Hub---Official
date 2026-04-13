import { useState, useEffect, useCallback } from "react";
import { portalFetch } from "@workspace/api-client-react";

interface UserRole {
  role: string;
  permissions: string[];
  label: string;
}

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    try {
      const res = await portalFetch("/api/roles/my-role", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserRole(data);
      } else if (res.status === 401 || res.status === 403) {
        // Unauthenticated/forbidden: keep UI usable without escalating permissions.
        setUserRole({
          role: "viewer",
          permissions: ["projects", "tasks", "chat"],
          label: "Osservatore",
        });
      } else {
        // Fallback: keep essential navigation without elevated permissions.
        setUserRole({
          role: "viewer",
          permissions: ["projects", "tasks", "chat"],
          label: "Osservatore",
        });
      }
    } catch {
      // Keep UI accessible even if auth/role API fails, without granting admin.
      setUserRole({
        role: "viewer",
        permissions: ["projects", "tasks", "chat"],
        label: "Osservatore",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const hasPermission = (permission: string) => {
    if (!userRole) return true;
    return userRole.permissions.includes(permission);
  };

  const isAdmin = userRole?.role === "admin";

  return { userRole, loading, hasPermission, isAdmin, refetch: fetchRole };
}
