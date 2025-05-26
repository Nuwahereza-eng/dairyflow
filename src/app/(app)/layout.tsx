"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader2 } from 'lucide-react';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, isLoading } = useAuth();
  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, isLoading, router]);

  useEffect(() => {
    // Derive page title from pathname
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      const title = pathSegments[pathSegments.length - 1];
      setPageTitle(title.charAt(0).toUpperCase() + title.slice(1));
    } else {
      setPageTitle('Dashboard');
    }
  }, [pathname]);

  if (isLoading || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col">
        <AppHeader pageTitle={pageTitle} />
        <div className="flex-grow p-6 overflow-auto">
          {children}
        </div>
        <OfflineIndicator />
      </main>
    </div>
  );
}
