import { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Github } from 'lucide-react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();

  // Don't show sidebar on login/setup pages
  const showSidebar = isAuthenticated && !location.pathname.includes('/setup') && !location.pathname.includes('/login');

  return (
    <div className="min-h-screen bg-background flex">
      {showSidebar && <Sidebar />}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-background sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!showSidebar && (
                  <a href="/admin" className="text-2xl font-bold hover:opacity-80 transition-opacity">
                    <span className="font-blackecho">Little</span><span>CMS</span>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="h-9 w-9 p-0"
                  aria-label="Toggle theme"
                >
                  {resolvedTheme === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
                
                {isAuthenticated && user && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">{user.name || user.login}</div>
                        <div className="text-xs text-muted-foreground">Admin</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logout.mutate()}
                      >
                        Logout
                      </Button>
                    </div>
                  </>
                )}
                {!isAuthenticated && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      window.location.href = 'https://github.com/apps/littlecms/installations/new';
                    }}
                  >
                    <Github className="w-4 h-4 mr-2" />
                    Install GitHub App
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

