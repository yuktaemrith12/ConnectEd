import { useRouteError, Link } from "react-router";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary() {
  const error = useRouteError() as any;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Oops! Something went wrong
        </h1>
        
        <p className="text-gray-600 mb-6">
          {error?.statusText || error?.message || "An unexpected error occurred"}
        </p>
        
        {error?.status === 404 && (
          <p className="text-sm text-gray-500 mb-6">
            The page you're looking for doesn't exist.
          </p>
        )}
        
        <Link to="/">
          <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-shadow">
            Go to Login
          </button>
        </Link>
      </div>
    </div>
  );
}
