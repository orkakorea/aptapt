import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export const MobileRedirectGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect mobile users from desktop routes to mobile routes
    if (isMobile && location.pathname === "/map") {
      navigate("/mobile" + location.search, { replace: true });
    }
  }, [isMobile, location.pathname, location.search, navigate]);

  return <>{children}</>;
};
