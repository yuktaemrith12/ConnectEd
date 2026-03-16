import { Navigate } from "react-router";
import { isAuthenticated, getStoredRole } from "@/app/utils/api";

interface ProtectedRouteProps {
  role: string;
  children: React.ReactNode;
}

/**
 * Wraps a route so only authenticated users with the correct role can access it.
 * - Unauthenticated → redirect to /
 * - Wrong role → alert + redirect to /
 */
export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const storedRole = getStoredRole();
  if (storedRole !== role) {
    alert("Access Denied. Please log in with the appropriate role.");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
