import { HashRouter, Navigate, Routes, Route } from 'react-router-dom';
import SetupPage from './pages/SetupPage';
import WelcomePage from './pages/WelcomePage';
import MainPage from './pages/MainPage';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import NewSessionPage from './pages/NewSessionPage';
import SessionsPage from './pages/SessionsPage';
import WorkbenchPage from './pages/WorkbenchPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import CollaborationPage from './pages/CollaborationPage';
import ControlCenterPage from './pages/ControlCenterPage';
import RepositoryProtocolPage from './pages/RepositoryProtocolPage';
import ExtensionsPage from './pages/ExtensionsPage';
import SettingsPage from './pages/SettingsPage';
import TaskKanbanPage from './pages/TaskKanbanPage';
import ActionCenterPage from './pages/ActionCenterPage';
import TeamsPage from './pages/TeamsPage';
import Office3DPage from './pages/Office3DPage';
import TuningPage from './pages/TuningPage';
import SessionChatPage from './pages/SessionChatPage';
import ArtifactsPage from './pages/ArtifactsPage';
import { ArtifactDetailPage } from './pages/ArtifactDetailPage';
import AppGuard from './components/AppGuard';
import { useSettingsStore } from './lib/settings-store';
import { DEFAULT_HOME_VIEW_OPTIONS } from './lib/settings-types';

function HomeRoute() {
  const defaultHomeView = useSettingsStore((s) => s.settings.defaultHomeView);
  const homeOption = DEFAULT_HOME_VIEW_OPTIONS.find((option) => option.value === defaultHomeView) ?? DEFAULT_HOME_VIEW_OPTIONS[0];

  if (homeOption.route !== '/') {
    return <Navigate to={homeOption.route} replace />;
  }

  return <DashboardPage />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route
          path="/"
          element={
            <AppGuard>
              <MainPage />
            </AppGuard>
          }
        >
          <Route index element={<HomeRoute />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="new-session" element={<NewSessionPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="workbench" element={<WorkbenchPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="collaboration" element={<CollaborationPage />} />
          <Route path="control-center" element={<ControlCenterPage />} />
          <Route path="repository-protocol" element={<RepositoryProtocolPage />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="taskkanban" element={<TaskKanbanPage />} />
          <Route path="actions" element={<ActionCenterPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="office" element={<Office3DPage />} />
          <Route path="tuning" element={<TuningPage />} />
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />
          <Route path="chat/:sessionKey" element={<SessionChatPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
