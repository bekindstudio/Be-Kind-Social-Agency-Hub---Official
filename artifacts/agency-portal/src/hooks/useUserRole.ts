import { useState, useEffect, useCallback } from "react";

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
      const res = await fetch("/api/roles/my-role");
      if (res.ok) {
        const data = await res.json();
        setUserRole(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const hasPermission = (permission: string) => {
    if (!userRole) return false;
    return userRole.permissions.includes(permission);
  };

  const isAdmin = userRole?.role === "admin";

  return { userRole, loading, hasPermission, isAdmin, refetch: fetchRole };
}
