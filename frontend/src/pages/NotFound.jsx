import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 opacity-15 absolute z-0 select-none">
        404
      </div>
      <div className="z-10 bg-white border border-slate-200 shadow-xl rounded-2xl p-12 max-w-lg w-full text-slate-900">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Page Not Found</h1>
        <p className="text-slate-600 mb-8 text-lg font-medium">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="btn btn-primary inline-flex items-center shadow-md shadow-blue-500/20 font-bold px-6 py-3">
          <Home className="w-5 h-5 mr-2" />
          Back to Home
        </Link>
      </div>
    </div>
  );
};


export default NotFound;
