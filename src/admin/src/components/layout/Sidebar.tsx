import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Plus,
  Moon,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import Logo from '@/components/ui/Logo';
import '@/components/fonts/fonts.css';

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: SidebarItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Content',
    href: '/admin/content',
    icon: FileText,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(href);
  };

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <aside className="w-full lg:w-64 border-r bg-muted/30 flex flex-col h-screen lg:sticky lg:top-0">
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b">
        <Link to="/admin" className="flex items-center gap-2" onClick={handleNavigate}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Logo className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold">
            <span className="font-blackecho">Little</span><span>CMS</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Quick Actions */}
      <div className="p-4 border-t space-y-2">
        <Button 
          className="w-full" 
          onClick={() => {
            handleNavigate();
            window.location.href = '/admin/content';
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="w-full"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 mr-2" />
              Light Mode
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 mr-2" />
              Dark Mode
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
