
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Truck, CreditCard, FileText, Settings as SettingsIcon, LogOut, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: ('admin' | 'operator' | 'farmer')[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'operator', 'farmer'] },
  { href: '/farmers', label: 'Farmers', icon: Users, roles: ['admin', 'operator'] },
  { href: '/deliveries', label: 'Deliveries', icon: Truck, roles: ['admin', 'operator', 'farmer'] },
  { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'operator'] },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ['admin', 'operator'] },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();

  const filteredNavItems = navItems.filter(item => 
    !item.roles || (currentUser && item.roles.includes(currentUser.role))
  );

  return (
    <aside className="sticky top-0 h-screen w-64 bg-card text-card-foreground border-r flex flex-col shadow-lg">
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Droplets className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary">DairyFlow</h1>
        </Link>
      </div>
      <nav className="flex-grow p-4 space-y-2">
        {filteredNavItems.map((item) => (
          <Button
            key={item.href}
            variant={pathname === item.href ? 'secondary' : 'ghost'}
            className={cn(
              "w-full justify-start",
              pathname === item.href && "bg-primary/10 text-primary font-semibold"
            )}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      <div className="p-4 border-t">
        {currentUser && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-foreground">{currentUser.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
          </div>
        )}
        <Button variant="outline" className="w-full justify-start" onClick={logout}>
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
