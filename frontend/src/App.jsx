import { Routes, Route, Navigate } from 'react-router-dom';
import HRLogin from './pages/HRLogin';
import HRDashboard from './pages/HRDashboard';
import DriveCreate from './pages/DriveCreate';
import CandidateApply from './pages/CandidateApply';
import NotFound from './pages/NotFound';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<HRLogin />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <HRDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/drives/new" 
        element={
          <ProtectedRoute>
            <DriveCreate />
          </ProtectedRoute>
        } 
      />
      <Route path="/apply/:driveId" element={<CandidateApply />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
