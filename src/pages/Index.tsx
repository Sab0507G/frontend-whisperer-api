import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Session } from "@supabase/supabase-js";
import { QrCode, Scan } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      setTimeout(() => {
        fetchUserRole(session.user.id);
      }, 0);
    }
  }, [session]);

  const fetchUserRole = async (userId: string) => {
    // types will update after migration
    const { data } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      // @ts-ignore
      setUserRole(data.role);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="text-5xl font-bold text-foreground leading-tight">
            Mark attendance in seconds with dynamic QR codes — secure, smart, and fast.
          </h1>
          <div className="flex gap-6 justify-center flex-wrap">
            {userRole === "teacher" && (
              <Button
                size="lg"
                className="text-lg px-8 py-6"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                onClick={() => navigate("/teacher")}
              >
                <QrCode className="mr-2 h-5 w-5" />
                Teacher Portal
              </Button>
            )}
            {userRole === "student" && (
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6"
                onClick={() => navigate("/student")}
              >
                <Scan className="mr-2 h-5 w-5" />
                Student Portal
              </Button>
            )}
            {!userRole && (
              <>
                <Button
                  size="lg"
                  className="text-lg px-8 py-6"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                  onClick={() => navigate("/teacher")}
                >
                  <QrCode className="mr-2 h-5 w-5" />
                  I'm a Teacher
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-lg px-8 py-6"
                  onClick={() => navigate("/student")}
                >
                  <Scan className="mr-2 h-5 w-5" />
                  I'm a Student
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
