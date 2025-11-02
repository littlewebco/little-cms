import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  selected: boolean;
}

export default function RepositorySelector() {
  const queryClient = useQueryClient();
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  // Fetch repositories
  const { data, isLoading, error } = useQuery({
    queryKey: ['repos'],
    queryFn: () => api.repos.list(),
    retry: 1,
  });

  // Fetch currently selected repos
  const { data: selectedData } = useQuery({
    queryKey: ['repos', 'selected'],
    queryFn: () => api.repos.selected(),
    retry: 1,
  });

  // Update selected repos when data loads
  useEffect(() => {
    if (selectedData?.repos) {
      setSelectedRepos(selectedData.repos);
    } else if (data?.repos) {
      // If no repos are selected yet, default to all repos
      const allRepos = data.repos.map(r => r.full_name);
      setSelectedRepos(allRepos);
    }
  }, [data, selectedData]);

  // Save selected repos
  const saveMutation = useMutation({
    mutationFn: (repos: string[]) => api.repos.select(repos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos', 'selected'] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    },
  });

  const handleToggleRepo = (repoFullName: string) => {
    const newSelection = selectedRepos.includes(repoFullName)
      ? selectedRepos.filter(r => r !== repoFullName)
      : [...selectedRepos, repoFullName];
    
    setSelectedRepos(newSelection);
  };

  const handleSave = () => {
    saveMutation.mutate(selectedRepos);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground">Loading repositories...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive">
            Error loading repositories: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Please check the browser console for more details.
          </div>
        </CardContent>
      </Card>
    );
  }

  const repos = data?.repos || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Repositories</CardTitle>
        <CardDescription>
          Choose which repositories LittleCMS can access. Even though the OAuth token grants access to all repos,
          only selected repositories will be accessible through the CMS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto border rounded-lg p-4 space-y-2">
            {repos.length === 0 ? (
              <p className="text-muted-foreground">No repositories found.</p>
            ) : (
              repos.map((repo) => (
                <label
                  key={repo.id}
                  className="flex items-start gap-3 p-3 rounded-md hover:bg-muted cursor-pointer border border-transparent hover:border-input"
                >
                  <input
                    type="checkbox"
                    checked={selectedRepos.includes(repo.full_name)}
                    onChange={() => handleToggleRepo(repo.full_name)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{repo.full_name}</span>
                      {repo.private && (
                        <span className="text-xs px-2 py-0.5 bg-secondary rounded">Private</span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground mt-1">{repo.description}</p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedRepos.length} of {repos.length} repositories selected
            </div>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Selection'}
            </Button>
          </div>

          {saveMutation.isSuccess && (
            <div className="text-sm text-green-600">
              ✓ Repository selection saved successfully
            </div>
          )}

          {saveMutation.isError && (
            <div className="text-sm text-destructive">
              ✗ Error saving selection: {saveMutation.error instanceof Error ? saveMutation.error.message : 'Unknown error'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
