import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './components/layout/Dashboard';
import ContentPage from './components/layout/ContentPage';
import SettingsPage from './components/layout/SettingsPage';
import SetupWizard from './components/layout/SetupWizard';
import { RequireAuth } from './components/layout/RequireAuth';

function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Layout />}>
        <Route index element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        } />
        <Route path="content" element={
          <RequireAuth>
            <ContentPage />
          </RequireAuth>
        } />
        <Route path="settings" element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        } />
        <Route path="setup" element={<SetupWizard />} />
        <Route path="dashboard" element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

