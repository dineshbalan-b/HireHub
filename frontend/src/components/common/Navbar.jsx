import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, User, PlusCircle, LayoutDashboard } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('token');

  // Try to get HR user info from localStorage
  const hrUserStr = localStorage.getItem('hr_user');
  let userName = 'HR Admin';
  if (hrUserStr) {
    try {
      const parsed = JSON.parse(hrUserStr);
      if (parsed?.name) userName = parsed.name;
    } catch (e) {
      // fallback
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('hr_user');
    navigate('/login');
  };

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs sticky top-0 z-50">
      <div className="w-full px-6 lg:px-10">
        <div className="flex justify-between items-center h-16">
          
          {/* Top-Left Corner: Logo & Dashboard Link */}
          <div className="flex items-center space-x-6">
            <Link to={isAuthenticated ? '/dashboard' : '/login'} className="flex items-center gap-2.5 group">
              <div className="w-9.5 h-9.5 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Agent<span className="text-blue-600">Hire</span>
              </span>
            </Link>
            
            {isAuthenticated && (
              <nav className="flex items-center space-x-2">
                <Link
                  to="/dashboard"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    location.pathname === '/dashboard'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
              </nav>
            )}
          </div>
          
          {/* Top-Right Corner: HR Admin Badge & Logout Button */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 text-slate-700 px-3.5 py-1.5 rounded-xl border border-slate-200/80 text-xs font-extrabold shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span>{userName}</span>
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200/80 px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-2xs cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="btn btn-primary text-xs font-bold px-4 py-2"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


export default Navbar;

