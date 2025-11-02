import { ReactNode } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/admin" className="text-2xl font-bold hover:opacity-80 transition-opacity">
                LittleCMS
              </Link>
              {isAuthenticated && user && (
                <nav className="flex items-center gap-2">
                  <Link
                    to="/admin"
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive('/admin') && location.pathname !== '/admin/settings'
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/settings"
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive('/admin/settings')
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    Settings
                  </Link>
                </nav>
              )}
            </div>
            <nav className="flex items-center gap-4">
              {isAuthenticated && user && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {user.name || user.login}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logout.mutate()}
                  >
                    Logout
                  </Button>
                </>
              )}
              {!isAuthenticated && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // Redirect to GitHub App installation page
                    window.location.href = 'https://github.com/apps/littlecms/installations/new';
                  }}
                >
                  Install GitHub App
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
        {children}
      </main>
    </div>
  );
}

