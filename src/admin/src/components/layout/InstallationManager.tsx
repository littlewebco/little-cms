import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, CheckCircle2, AlertCircle, Github } from 'lucide-react';

interface Installation {
  id: number;
  account: { login: string; type: string };
  repository_selection: string;
  repos_count: number;
  selected_repos_count: number;
}

export default function InstallationManager() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['repos', 'installations'],
    queryFn: () => api.repos.installations(),
    retry: 1,
  });

  const installations = data?.installations || [];

  const handleInstall = async () => {
    try {
      const { url } = await api.repos.installUrl('/admin/settings');
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get installation URL:', error);
      alert('Failed to get installation URL. Please try again.');
    }
  };

  const handleUpdate = async (installationId: number) => {
    // GitHub App update URL - redirects to the app's installation settings
    window.location.href = `https://github.com/settings/installations/${installationId}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground">Loading installation status...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive">
            Error loading installation status: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub App Installation</CardTitle>
        <CardDescription>
          {installations.length > 0 
            ? 'Manage your GitHub App installations and configure repository access.'
            : 'Install or update the GitHub App to grant LittleCMS access to your repositories.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {installations.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold mb-1">No Installation Found</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  You need to install the GitHub App on your repositories to enable content management.
                </p>
                <Button onClick={handleInstall} className="w-full sm:w-auto">
                  <Github className="w-4 h-4 mr-2" />
                  Install GitHub App
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {installations.map((installation: Installation) => (
              <div
                key={installation.id}
                className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-semibold">
                        {installation.account.type === 'Organization' ? 'Organization' : 'User'}: {installation.account.login}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Installation #{installation.id}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      {installation.repository_selection === 'all' ? 'All repositories' : 'Selected repositories'}
                    </div>
                    <div>
                      {installation.repos_count} {installation.repos_count === 1 ? 'repository' : 'repositories'} accessible
                      {installation.selected_repos_count > 0 && (
                        <span className="ml-1">
                          • {installation.selected_repos_count} selected in CMS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdate(installation.id)}
                >
                  <Github className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </div>
            ))}
            
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={handleInstall}
                className="w-full sm:w-auto"
              >
                <Github className="w-4 h-4 mr-2" />
                Install on Additional Account
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

