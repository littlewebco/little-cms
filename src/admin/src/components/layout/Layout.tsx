import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">LittleCMS</h1>
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
                    window.location.href = '/api/auth/login';
                  }}
                >
                  Login with GitHub
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

