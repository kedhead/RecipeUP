import React from 'react';
import { Navbar } from '../navigation/navbar';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: 'USER' | 'ADMIN';
  subscriptionTier: 'FREE' | 'PREMIUM' | 'FAMILY';
  emailVerified: boolean;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}