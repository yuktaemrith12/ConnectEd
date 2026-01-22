import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Users, GraduationCap, BookOpen, Calendar, UserPlus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { toast } from "sonner";
import { API_BASE_URL } from "../../config/api";

type DashboardPayload = {
  stats: {
    total_students: number;
    students_delta_month: number;
    total_teachers: number;
    teachers_delta_month: number;
    active_classes: number;
    subjects_count: number;
    weekly_sessions: number;
  };
  weekly_classes: { day: string; classes: number }[];
  enrollment_trend: { month: string; students: number }[];
  recent_activities: { action: string; user: string; time: string }[];
  system_health: { server_status: string; database: string; active_sessions: number };
  storage_usage: { video_recordings: string; documents: string; total_available: string };
  engagement_stats: { avg_attendance: number; avg_engagement: number; sessions_recorded: number };
};

export default function AdminDashboard() {
  const token = localStorage.getItem("token");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    }),
    [token]
  );

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dashboard`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.detail ?? "Failed to load dashboard");
      setData(json);
    } catch (e: any) {
      toast.error(e?.message ?? "Cannot reach backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = data?.stats;
  const weeklyClasses = data?.weekly_classes ?? [];
  const enrollmentTrend = data?.enrollment_trend ?? [];
  const recentActivities = data?.recent_activities ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-1">Admin Dashboard</h1>
          <p className="text-muted-foreground">System overview and management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => toast.info("Go to Manage Users → Add User")}>
            <UserPlus className="size-4" />
            Add User
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => toast.info("Go to Class Allocation → Create Class")}>
            <BookOpen className="size-4" />
            Create Class
          </Button>
          <Button variant="outline" className="gap-2" onClick={fetchDashboard}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">{loading ? "—" : stats?.total_students ?? 0}</span>
              <Users className="size-8 text-indigo-500" />
            </div>
            <p className="text-xs text-green-600 mt-2">
              {loading ? "" : `+${stats?.students_delta_month ?? 0} this month`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">{loading ? "—" : stats?.total_teachers ?? 0}</span>
              <GraduationCap className="size-8 text-green-500" />
            </div>
            <p className="text-xs text-green-600 mt-2">
              {loading ? "" : `+${stats?.teachers_delta_month ?? 0} this month`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Active Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">{loading ? "—" : stats?.active_classes ?? 0}</span>
              <BookOpen className="size-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {loading ? "" : `${stats?.subjects_count ?? 0} subjects`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Weekly Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl">{loading ? "—" : stats?.weekly_sessions ?? 0}</span>
              <Calendar className="size-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {loading ? "" : `${((stats?.weekly_sessions ?? 0) / 5).toFixed(1)} sessions/day avg`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Class Distribution</CardTitle>
            <CardDescription>Number of timetable slots per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyClasses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="classes" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Enrollment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Student Enrollment Trend</CardTitle>
            <CardDescription>Total enrolled students over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="students" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest system updates and actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(recentActivities.length ? recentActivities : [{ action: "No activity yet", user: "", time: "" }]).map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                <div>
                  <p className="text-sm">{a.action}</p>
                  <p className="text-xs text-muted-foreground">{a.user}</p>
                </div>
                <span className="text-xs text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Server Status</span>
                <span className="text-green-600">{data?.system_health.server_status ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Database</span>
                <span className="text-green-600">{data?.system_health.database ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active Sessions</span>
                <span>{data?.system_health.active_sessions ?? "—"} live</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Video Recordings</span>
                <span>{data?.storage_usage.video_recordings ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Documents</span>
                <span>{data?.storage_usage.documents ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Total Available</span>
                <span>{data?.storage_usage.total_available ?? "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Avg. Attendance</span>
                <span className="text-green-600">{data?.engagement_stats.avg_attendance ?? "—"}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Avg. Engagement</span>
                <span className="text-indigo-600">{data?.engagement_stats.avg_engagement ?? "—"}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Sessions Recorded</span>
                <span>{data?.engagement_stats.sessions_recorded ?? "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
