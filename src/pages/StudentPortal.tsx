import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";

export default function StudentPortal() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [scannedContent, setScannedContent] = useState<string>("");

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
    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, [scanner]);

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {}
      );

      setScanning(true);
      toast.success("Camera started");
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Failed to start camera. Please allow camera access.");
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        setScanning(false);
        toast.info("Camera stopped");
      } catch (error) {
        console.error("Stop error:", error);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    setScannedContent(decodedText);
    await stopScanning();

    // Verify QR code and mark attendance - types will update after migration
    const { data: qrSession, error: qrError } = await (supabase as any)
      .from("qr_sessions")
      .select("*")
      .eq("qr_data", decodedText)
      .single();

    if (qrError || !qrSession) {
      toast.error("Invalid or expired QR code");
      return;
    }

    const now = new Date();
    // @ts-ignore
    const expiresAt = new Date(qrSession.expires_at);

    if (now > expiresAt) {
      toast.error("QR code has expired");
      return;
    }

    // Mark attendance - types will update after migration
    const { error: attendanceError } = await (supabase as any).from("attendance").insert({
      student_id: session?.user.id,
      qr_session_id: qrSession.id,
      class_id: qrSession.class_id,
    });

    if (attendanceError) {
      if (attendanceError.code === "23505") {
        toast.error("Attendance already marked for this session");
      } else {
        toast.error("Failed to mark attendance");
      }
    } else {
      toast.success("Attendance marked successfully!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>QR Scanner – Student Portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Allow camera access and scan the class QR code to mark attendance.
            </p>

            <div className="flex gap-4">
              {!scanning ? (
                <Button
                  onClick={startScanning}
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
              ) : (
                <Button onClick={stopScanning} variant="secondary">
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Camera
                </Button>
              )}
            </div>

            <div
              id="reader"
              className="w-full rounded-lg overflow-hidden"
              style={{ minHeight: scanning ? "300px" : "0" }}
            />

            {scannedContent && (
              <div className="p-4 bg-secondary rounded-lg">
                <h4 className="font-medium mb-2">Scanned QR Content:</h4>
                <p className="text-sm text-muted-foreground break-all">
                  {scannedContent}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
