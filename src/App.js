import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import CitizenLayout from "@/components/CitizenLayout";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Feed from "@/pages/Feed";
import Report from "@/pages/Report";
import MapView from "@/pages/MapView";
import MyReports from "@/pages/MyReports";
import Leaderboard from "@/pages/Leaderboard";
import AdminDashboard from "@/pages/AdminDashboard";
import WorkerView from "@/pages/WorkerView";

function FullLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#07090E]">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  );
}

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin" : user.role === "worker" ? "/worker" : "/feed"} replace />;
  }
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster theme="dark" position="top-center" richColors closeButton />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route
              element={
                <Protected>
                  <CitizenLayout />
                </Protected>
              }
            >
              <Route path="/feed" element={<Feed />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/report" element={<Report />} />
              <Route path="/my" element={<MyReports />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
            </Route>
            <Route
              path="/admin"
              element={
                <Protected roles={["admin"]}>
                  <AdminDashboard />
                </Protected>
              }
            />
            <Route
              path="/worker"
              element={
                <Protected roles={["admin", "worker"]}>
                  <WorkerView />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
