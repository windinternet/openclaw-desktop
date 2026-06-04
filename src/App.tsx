import { HashRouter, Routes, Route } from 'react-router-dom';
import SetupPage from './pages/SetupPage';
import WelcomePage from './pages/WelcomePage';
import MainPage from './pages/MainPage';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import NewSessionPage from './pages/NewSessionPage';
import ExtensionsPage from './pages/ExtensionsPage';
import SettingsPage from './pages/SettingsPage';
import TaskKanbanPage from './pages/TaskKanbanPage';
import ActionCenterPage from './pages/ActionCenterPage';
import TeamsPage from './pages/TeamsPage';
import Office3DPage from './pages/Office3DPage';
import MemoryPage from './pages/MemoryPage';
import SessionChatPage from './pages/SessionChatPage';
import AppGuard from './components/AppGuard';

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
          <Route index element={<DashboardPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="new-session" element={<NewSessionPage />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="taskkanban" element={<TaskKanbanPage />} />
          <Route path="actions" element={<ActionCenterPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="office" element={<Office3DPage />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="chat/:sessionKey" element={<SessionChatPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
