// src/App.tsx
import React, { useMemo } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FarmMapPage } from "./pages/FarmMapPage";
import { PlotManagementPage } from "./pages/PlotManagementPage";
import { PlotDetailsPage } from "./pages/PlotDetailsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { RescheduleCenterPage } from "./pages/RescheduleCenterPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { WorkersPage } from "./pages/WorkersPage";
import { ConfigurationPage } from "./pages/ConfigurationPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ProfilePage } from "./pages/ProfilePage";

function pageKeyFromPath(pathname: string): string {
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/reschedule")) return "reschedule";
  if (pathname.startsWith("/farm-map")) return "farm-map";
  if (pathname === "/plots") return "plots";
  if (pathname.startsWith("/plots/") && pathname.endsWith("/schedule"))
    return "schedule";
  if (pathname.startsWith("/plots/") && pathname.endsWith("/reschedule"))
    return "reschedule";
  if (pathname.startsWith("/plots/")) return "plot-details";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/workers")) return "workers";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/profile")) return "profile";
  return "dashboard";
}


function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem("access_token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = useMemo(
    () => pageKeyFromPath(location.pathname),
    [location.pathname],
  );

  // keep your existing API: onNavigate(page, plotId?)
  const onNavigate = (page: string, plotId?: string) => {
    const rawPlotId =
      plotId ?? sessionStorage.getItem("last_plot_id") ?? undefined;
    const lastPlotId =
      rawPlotId == null || String(rawPlotId).trim() === ""
        ? undefined
        : String(rawPlotId);

    if (plotId != null && String(plotId).trim() !== "") {
      sessionStorage.setItem("last_plot_id", String(plotId));
    }

    switch (page) {
      case "dashboard":
        return navigate("/dashboard");
      case "farm-map":
        return navigate("/farm-map");
      case "plots":
        return navigate("/plots");
      case "plot-details":
        return lastPlotId
          ? navigate(`/plots/${encodeURIComponent(lastPlotId)}`)
          : navigate("/plots");
      case "schedule":
        return navigate("/schedule");
      case "reschedule":
        return navigate("/reschedule");
        // // If you keep Reschedule global later, change to navigate("/reschedule")
        // return lastPlotId
        //   ? navigate(`/plots/${lastPlotId}/reschedule`)
        //   : navigate("/plots");
      case "analytics":
        return navigate("/analytics");
      case "workers":
        return navigate("/workers");
      case "settings":
        return navigate("/settings");
      case "reports":
        return navigate("/reports");
      case "profile":
        return navigate("/profile");
      default:
        return navigate("/dashboard");
    }
  };

  return (
    <>
      <Routes>
        {/* smart entry */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* login route (no sidebar) */}
        <Route
          path="/login"
          element={
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
              <LoginPage
                onLogin={() => {
                  navigate("/dashboard", { replace: true });
                }}
              />
            </div>
          }
        />

        {/* protected layout route */}
        <Route
          element={
            <RequireAuth>
              <AppLayout currentPage={currentPage} onNavigate={onNavigate} />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage onNavigate={onNavigate} />} />
          <Route path="/farm-map" element={<FarmMapPage onNavigate={onNavigate} />} />
          <Route path="/plots" element={<PlotManagementPage onNavigate={onNavigate} />} />

          {/* plot-scoped */}
          <Route path="/plots/:plotId" element={<PlotDetailsPage onNavigate={onNavigate} />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/reschedule" element={<RescheduleCenterPage />} />

          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/settings" element={<ConfigurationPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
      </Routes>

      <Toaster position="top-right" />
    </>
  );
}
