import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            RecipeUp <span className="text-brand-600">v2</span>
          </h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">{title}</h2>
          {subtitle && (
            <p className="text-gray-600">{subtitle}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          {children}
        </div>
        <div className="text-center text-sm text-gray-500">
          <p>Modern recipe management and family meal planning</p>
        </div>
      </div>
    </div>
  );
}