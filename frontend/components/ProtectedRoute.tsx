"use client";

import { useEffect, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/store/Auth";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { token, hasUIPermission } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authorization status
    const checkAuth = () => {
      // if (!token) {
      //   // No token, redirect to login
        
      //   router.push("/login");
      //   return false;
      // }
   
      // if (requiredPermission && !hasUIPermission(requiredPermission)) {
      //   // Has token but missing required permission, redirect to home
      //   router.push("/");
      //   return false;
      // }

      return true;
    };

    const authorized = checkAuth();
    setIsAuthorized(authorized);
    setIsLoading(false);
  }, [token, requiredPermission, hasUIPermission, router]);

  

  // Show loading or nothing while checking permissions or redirecting
  if (isLoading || !isAuthorized) {
    return null;
  }

  if (!token) {
    router.push("/login");
    return null;
  }

  return <div className="max-h-screen space-y-4">{children}</div>;
} 