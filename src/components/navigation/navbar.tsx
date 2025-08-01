'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

interface NavbarProps {
  user?: User;
}

export function Navbar({ user }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center">
              <span className="text-2xl font-bold text-gray-900">
                RecipeUp <span className="text-brand-600">v2</span>
              </span>
            </Link>
            
            {user && (
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-brand-600 px-3 py-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/recipes"
                  className="text-gray-700 hover:text-brand-600 px-3 py-2 text-sm font-medium"
                >
                  Recipes
                </Link>
                <Link
                  href="/meal-plans"
                  className="text-gray-700 hover:text-brand-600 px-3 py-2 text-sm font-medium"
                >
                  Meal Plans
                </Link>
                <Link
                  href="/family"
                  className="text-gray-700 hover:text-brand-600 px-3 py-2 text-sm font-medium"
                >
                  Family
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden md:flex md:items-center md:space-x-4">
                  <span className="text-sm text-gray-700">
                    Welcome, {user.firstName || user.username}
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    isLoading={isLoggingOut}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                  </Button>
                </div>
                
                {/* Mobile menu button */}
                <div className="md:hidden">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-gray-700 hover:text-brand-600 p-2"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/auth/login"
                  className="text-gray-700 hover:text-brand-600 px-3 py-2 text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link href="/auth/register">
                  <Button>
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {user && isMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              <Link
                href="/dashboard"
                className="block text-gray-700 hover:text-brand-600 px-3 py-2 text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/recipes"
                className="block text-gray-700 hover:text-brand-600 px-3 py-2 text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Recipes
              </Link>
              <Link
                href="/meal-plans"
                className="block text-gray-700 hover:text-brand-600 px-3 py-2 text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Meal Plans
              </Link>
              <Link
                href="/family"
                className="block text-gray-700 hover:text-brand-600 px-3 py-2 text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Family
              </Link>
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="px-3 mb-3">
                <p className="text-sm text-gray-700">
                  Signed in as {user.firstName || user.username}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                isLoading={isLoggingOut}
                disabled={isLoggingOut}
                className="mx-3"
              >
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}