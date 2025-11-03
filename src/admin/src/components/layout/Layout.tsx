import { ReactNode, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Github, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show sidebar on login/setup pages
  const showSidebar = isAuthenticated && !location.pathname.includes('/setup') && !location.pathname.includes('/login');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      {showSidebar && (
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-muted/30 lg:h-screen lg:sticky lg:top-0">
          <Sidebar />
        </aside>
      )}
      
      {/* Mobile Sheet */}
      {showSidebar && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent onClose={() => setMobileMenuOpen(false)}>
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-background sticky top-0 z-10">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {showSidebar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}
                {!showSidebar && (
                  <a href="/admin" className="text-xl sm:text-2xl font-bold hover:opacity-80 transition-opacity">
                    <span className="font-blackecho">Little</span><span>CMS</span>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
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
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">{user.name || user.login}</div>
                        <div className="text-xs text-muted-foreground">Admin</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logout.mutate()}
                      className="text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Logout</span>
                      <span className="sm:hidden">Out</span>
                    </Button>
                  </>
                )}
                {!isAuthenticated && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      window.location.href = 'https://github.com/apps/littlecms/installations/new';
                    }}
                    className="text-xs sm:text-sm"
                  >
                    <Github className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Install GitHub App</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">
            <Outlet />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

