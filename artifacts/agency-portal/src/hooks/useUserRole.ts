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
      const res = await portalFetch("/api/roles/my-role");
      if (res.ok) {
        const data = await res.json();
        setUserRole(data);
      } else {
        // Fallback: avoid hiding navigation if role endpoint is temporarily unavailable.
        setUserRole({
          role: "admin",
          permissions: ["clients", "projects", "tasks", "team", "chat", "files", "quotes", "contracts", "reports", "settings", "roles"],
          label: "Amministratore",
        });
      }
    } catch {
      // Keep UI accessible even if auth/role API fails.
      setUserRole({
        role: "admin",
        permissions: ["clients", "projects", "tasks", "team", "chat", "files", "quotes", "contracts", "reports", "settings", "roles"],
        label: "Amministratore",
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
