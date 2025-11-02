import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import RepositorySelector from './RepositorySelector';
import InstallationManager from './InstallationManager';
import CategoryManager from './CategoryManager';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Invalidate and refetch all repository-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['repos', 'installations'] }),
        queryClient.invalidateQueries({ queryKey: ['repos', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['repos', 'selected'] }),
      ]);
      // Refetch all queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['repos', 'installations'] }),
        queryClient.refetchQueries({ queryKey: ['repos', 'list'] }),
        queryClient.refetchQueries({ queryKey: ['repos', 'selected'] }),
      ]);
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Settings</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RotateCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync'}
        </Button>
      </div>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-4">GitHub App Installation</h3>
          <p className="text-muted-foreground mb-4">
            Install or update the GitHub App to grant LittleCMS access to your repositories. 
            You can install it on your personal account or on organizations you belong to.
          </p>
          <InstallationManager />
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Repository Access</h3>
          <p className="text-muted-foreground mb-4">
            Select which repositories LittleCMS can access. Even though the GitHub App installation grants access to all repos,
            only selected repositories will be accessible through the CMS.
          </p>
          <RepositorySelector />
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Categories</h3>
          <p className="text-muted-foreground mb-4">
            Manage post categories. Rename categories, view posts by category, and organize your content.
          </p>
          <CategoryManager />
        </div>
      </div>
    </div>
  );
}

