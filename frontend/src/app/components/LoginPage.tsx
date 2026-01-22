import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { GraduationCap, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "../App";
import { API_BASE_URL } from "../config/api";

interface LoginPageProps {
  onLogin: (role: UserRole, name: string) => void;
}

type LoginResponse = {
  token: string;
  role: UserRole; // "student" | "teacher" | "admin"
  full_name: string;
  email: string;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = (await res.json()) as Partial<LoginResponse> & { detail?: string };

      if (!res.ok) {
        toast.error(data.detail || "Login failed");
        return;
      }

      if (!data.token || !data.role || !data.full_name) {
        toast.error("Invalid response from server. Please try again.");
        return;
      }

      // Save token for admin actions + protected routes
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("user_name", data.full_name);
      localStorage.setItem("user_email", cleanEmail);

      toast.success("Login successful!");
      onLogin(data.role as UserRole, data.full_name);
    } catch (err) {
      toast.error("Cannot reach the server. Make sure the backend is running on port 8000.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 text-indigo-600">
            <GraduationCap className="size-10" />
          </div>
          <div>
            <CardTitle className="text-3xl">ConnectEd</CardTitle>
            <CardDescription className="text-base mt-2">
              Smart Online Learning with Emotion Analytics
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. yuktae@student.connected.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Password reset will be added later (admin can reset for now).");
                }}
                className="text-sm text-indigo-600 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>

            <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <p className="text-xs text-muted-foreground text-center">
                Use your ConnectEd email format:
                <br />
                <span className="font-medium">firstname+initial@student.connected.com</span>{" "}
                (or <span className="font-medium">@teacher.connected.com</span> /{" "}
                <span className="font-medium">@admin.connected.com</span>)
              </p>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Your webcam may be used for emotion recognition to enhance learning experience.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
