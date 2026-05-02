import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import HistoryPage from '@/pages/HistoryPage';
import RecurringPage from '@/pages/RecurringPage';
import SettingsPage from '@/pages/SettingsPage';
import PendingApprovalPage from '@/pages/PendingApprovalPage';
import AdminPage from '@/pages/AdminPage';
import GoalsPage from '@/pages/GoalsPage';
import AdvisorPage from '@/pages/AdvisorPage';
import LiberationToolsPage from '@/pages/LiberationToolsPage';
import ReportsPage from '@/pages/ReportsPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import AccessibilityPage from '@/pages/AccessibilityPage';

function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved, profile } = useAuth();
  if (loading || (user && profile === null)) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isApproved) return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, profile } = useAuth();
  if (loading || (user && profile === null)) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors theme="dark" />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pending-approval" element={<PendingApprovalPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/recurring" element={<ProtectedRoute><RecurringPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
        <Route path="/advisor" element={<ProtectedRoute><AdvisorPage /></ProtectedRoute>} />
        <Route path="/liberation" element={<ProtectedRoute><LiberationToolsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
