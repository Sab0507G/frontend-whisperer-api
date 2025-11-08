import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, TrendingUp, Award, Clock } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

interface StudentProfile {
  id: string;
  full_name: string;
  roll_number: string;
  user_id: string;
}

interface AttendanceRecord {
  id: string;
  marked_at: string;
  class_id: string;
  qr_session_id: string;
  classes: {
    name: string;
  };
}

interface ClassAttendance {
  class_name: string;
  total: number;
  present: number;
  percentage: number;
}

interface MonthlyTrend {
  month: string;
  count: number;
}

export default function StudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classStats, setClassStats] = useState<ClassAttendance[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalClasses: 0,
    totalPresent: 0,
    attendanceRate: 0,
    currentStreak: 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setSession(session);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (session && studentId) {
      fetchStudentData();
      fetchAttendanceData();
    }
  }, [session, studentId]);

  useEffect(() => {
    if (attendanceRecords.length > 0) {
      calculateStats();
    }
  }, [attendanceRecords]);

  const fetchStudentData = async () => {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("id", studentId)
      .single();

    if (!error && data) {
      setStudent(data);
    }
  };

  const fetchAttendanceData = async () => {
    const { data, error } = await (supabase as any)
      .from("attendance")
      .select(`
        *,
        classes(name)
      `)
      .eq("student_id", studentId)
      .order("marked_at", { ascending: false });

    if (!error && data) {
      setAttendanceRecords(data);
    }
  };

  const calculateStats = () => {
    // Overall stats
    const totalPresent = attendanceRecords.length;
    
    // Get unique sessions per class
    const sessionsByClass = new Map<string, Set<string>>();
    attendanceRecords.forEach(record => {
      const className = record.classes.name;
      if (!sessionsByClass.has(className)) {
        sessionsByClass.set(className, new Set());
      }
      sessionsByClass.get(className)!.add(record.qr_session_id);
    });

    let totalSessions = 0;
    sessionsByClass.forEach(sessions => {
      totalSessions += sessions.size;
    });

    // Calculate class-wise stats
    const classMap = new Map<string, ClassAttendance>();
    attendanceRecords.forEach(record => {
      const className = record.classes.name;
      if (!classMap.has(className)) {
        classMap.set(className, {
          class_name: className,
          total: 0,
          present: 0,
          percentage: 0,
        });
      }
      classMap.get(className)!.present++;
    });

    // Update with total sessions and calculate percentage
    sessionsByClass.forEach((sessions, className) => {
      if (classMap.has(className)) {
        const stats = classMap.get(className)!;
        stats.total = sessions.size;
        stats.percentage = (stats.present / stats.total) * 100;
      }
    });

    setClassStats(Array.from(classMap.values()));

    // Calculate current streak
    const sortedDates = attendanceRecords
      .map(r => new Date(r.marked_at).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();
    
    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (sortedDates[i] === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    // Calculate monthly trends (last 6 months)
    const monthlyMap = new Map<string, number>();
    const today2 = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today2.getFullYear(), today2.getMonth() - i, 1);
      const monthKey = format(date, 'MMM yyyy');
      monthlyMap.set(monthKey, 0);
    }

    attendanceRecords.forEach(record => {
      const monthKey = format(new Date(record.marked_at), 'MMM yyyy');
      if (monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
      }
    });

    const trends = Array.from(monthlyMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    setMonthlyTrends(trends);

    setOverallStats({
      totalClasses: totalSessions,
      totalPresent,
      attendanceRate: totalSessions > 0 ? (totalPresent / totalSessions) * 100 : 0,
      currentStreak: streak,
    });
  };

  const chartConfig = {
    count: {
      label: "Attendance",
      color: "hsl(var(--primary))",
    },
  };

  if (!session || !student) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/teacher">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teacher Portal
            </Button>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{student.full_name}</h1>
              <p className="text-muted-foreground">Roll Number: {student.roll_number}</p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {overallStats.attendanceRate.toFixed(1)}% Overall
            </Badge>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalClasses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Days Present</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalPresent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.attendanceRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.currentStreak} days</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Attendance Trend</CardTitle>
              <CardDescription>Last 6 months attendance pattern</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Class-wise Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Performance by Class</CardTitle>
              <CardDescription>Attendance percentage per class</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="class_name" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="percentage" 
                      fill="hsl(var(--accent))" 
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Class Statistics Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Class-wise Statistics</CardTitle>
            <CardDescription>Detailed attendance breakdown by class</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Name</TableHead>
                  <TableHead className="text-center">Total Sessions</TableHead>
                  <TableHead className="text-center">Days Present</TableHead>
                  <TableHead className="text-center">Attendance Rate</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classStats.map((stat, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{stat.class_name}</TableCell>
                    <TableCell className="text-center">{stat.total}</TableCell>
                    <TableCell className="text-center">{stat.present}</TableCell>
                    <TableCell className="text-center">{stat.percentage.toFixed(1)}%</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={stat.percentage >= 75 ? "default" : stat.percentage >= 60 ? "secondary" : "destructive"}
                      >
                        {stat.percentage >= 75 ? "Good" : stat.percentage >= 60 ? "Fair" : "Poor"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Attendance History */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>Complete record of all attendance marks</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.marked_at), "PPp")}
                      </TableCell>
                      <TableCell>{record.classes.name}</TableCell>
                      <TableCell>
                        <Badge variant="default">Present</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
