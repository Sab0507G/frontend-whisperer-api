import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        
        setUserRole(data?.role || null);
      }
    };

    fetchUserRole();
  }, [location.pathname]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Logout failed");
    } else {
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-gradient-to-r from-primary via-primary-glow to-accent shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-primary-foreground">
            Smart QR Attendance
          </h1>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors hover:text-primary-foreground ${
              isActive("/")
                ? "text-primary-foreground underline"
                : "text-primary-foreground/80"
            }`}
          >
            Home
          </Link>
          
          {userRole === "student" && (
            <>
              <Link
                to="/student"
                className={`text-sm font-medium transition-colors hover:text-primary-foreground ${
                  isActive("/student")
                    ? "text-primary-foreground underline"
                    : "text-primary-foreground/80"
                }`}
              >
                Scan QR
              </Link>
              <Link
                to="/student/history"
                className={`text-sm font-medium transition-colors hover:text-primary-foreground ${
                  isActive("/student/history")
                    ? "text-primary-foreground underline"
                    : "text-primary-foreground/80"
                }`}
              >
                My Attendance
              </Link>
            </>
          )}
          
          {userRole === "teacher" && (
            <Link
              to="/teacher"
              className={`text-sm font-medium transition-colors hover:text-primary-foreground ${
                isActive("/teacher")
                  ? "text-primary-foreground underline"
                  : "text-primary-foreground/80"
              }`}
            >
              Teacher Portal
            </Link>
          )}
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            className="ml-2"
          >
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
};
