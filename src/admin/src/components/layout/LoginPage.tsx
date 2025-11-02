import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Github } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  // Check if user has installations (only if authenticated)
  const { data: installationsData } = useQuery({
    queryKey: ['repos', 'installations'],
    queryFn: () => api.repos.installations(),
    retry: 1,
    enabled: isAuthenticated, // Only fetch if authenticated
  });

  const installations = installationsData?.installations || [];

  // If authenticated and has installations, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && installations.length > 0) {
      navigate('/admin');
    }
  }, [isAuthenticated, installations.length, navigate]);

  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to LittleCMS</CardTitle>
          <CardDescription>
            Sign in with GitHub to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Get Started</h3>
            <p className="text-sm text-muted-foreground">
              Login with GitHub to authenticate. After logging in, you'll be able to install the GitHub App on your repositories to enable content management.
            </p>
            <Button onClick={handleLogin} variant="default" className="w-full" size="lg">
              <Github className="w-5 h-5 mr-2" />
              Login with GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
