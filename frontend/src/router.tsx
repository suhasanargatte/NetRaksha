import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "@/components/layout/Shell";
import Dashboard from "@/pages/Dashboard";
import LogAnalysis from "@/pages/LogAnalysis";
import Alerts from "@/pages/Alerts";
import Investigations from "@/pages/Investigations";
import Timeline from "@/pages/Timeline";
import Integrity from "@/pages/Integrity";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logs" element={<LogAnalysis />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/investigations" element={<Investigations />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/integrity" element={<Integrity />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
