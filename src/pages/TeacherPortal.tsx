import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import QRCode from "qrcode";

export default function TeacherPortal() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [qrData, setQrData] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [attendance, setAttendance] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      fetchClasses();
      fetchAttendance();
    }
  }, [session]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && qrData) {
      setQrData("");
      toast.info("QR code expired");
    }
  }, [timeLeft, qrData]);

  const fetchClasses = async () => {
    // types will update after migration
    const { data } = await (supabase as any).from("classes").select("*");
    if (data) setClasses(data);
  };

  const fetchAttendance = async () => {
    // types will update after migration
    const { data } = await (supabase as any)
      .from("attendance")
      .select(`
        *,
        profiles:student_id(full_name, roll_number),
        classes:class_id(name)
      `)
      .order("marked_at", { ascending: false })
      .limit(20);
    if (data) setAttendance(data);
  };

  const generateQR = async () => {
    if (!selectedClass) {
      toast.error("Please select a class");
      return;
    }

    const timestamp = Date.now();
    const qrDataString = `${selectedClass}_${timestamp}`;
    const expiresAt = new Date(timestamp + 60000).toISOString();

    // types will update after migration
    const { error } = await (supabase as any).from("qr_sessions").insert({
      class_id: selectedClass,
      teacher_id: session?.user.id,
      qr_data: qrDataString,
      expires_at: expiresAt,
    });

    if (error) {
      toast.error("Failed to generate QR code");
      return;
    }

    setQrData(qrDataString);
    setTimeLeft(60);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrDataString, {
        width: 256,
        color: {
          dark: "#E85C0D",
          light: "#FFFFFF",
        },
      });
    }

    toast.success("QR code generated!");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>QR Code Generator – Teacher Portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Subject/Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Choose a class --" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={generateQR}
              style={{ background: "var(--gradient-primary)" }}
            >
              Generate QR Code
            </Button>

            {qrData && (
              <div className="flex flex-col items-center gap-4 p-6 bg-secondary rounded-lg">
                <canvas ref={canvasRef} />
                <div className="text-center">
                  <p className="text-sm font-medium">Time Remaining:</p>
                  <p className="text-3xl font-bold text-primary">{timeLeft}s</p>
                </div>
              </div>
            )}

            {!qrData && timeLeft === 0 && selectedClass && (
              <div className="text-center p-6 bg-destructive/10 rounded-lg">
                <p className="text-destructive font-medium">
                  QR expired! Please generate again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.profiles?.full_name || "N/A"}</TableCell>
                      <TableCell>{record.profiles?.roll_number || "N/A"}</TableCell>
                      <TableCell>{record.classes?.name || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(record.marked_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {attendance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No attendance records yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
