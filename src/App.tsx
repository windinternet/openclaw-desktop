import { HashRouter, Routes, Route } from 'react-router-dom';
import SetupPage from './pages/SetupPage';
import WelcomePage from './pages/WelcomePage';
import MainPage from './pages/MainPage';
import AppGuard from './components/AppGuard';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route
          path="/*"
          element={
            <AppGuard>
              <MainPage />
            </AppGuard>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;
