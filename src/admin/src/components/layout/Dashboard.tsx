import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getAllMarkdownFiles, type MarkdownFile } from '@/lib/utils';
import Modal from '@/components/ui/modal';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileTextIcon, ListIcon, GridIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type ViewMode = 'list' | 'card';

interface RepoGroup {
  repo: string;
  files: MarkdownFile[];
}

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFile, setSelectedFile] = useState<{ file: MarkdownFile; repo: string } | null>(null);
  const [repoGroups, setRepoGroups] = useState<RepoGroup[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Fetch selected repositories
  const { data: selectedReposData, isLoading: reposLoading } = useQuery({
    queryKey: ['repos', 'selected'],
    queryFn: () => api.repos.selected(),
  });

  const selectedRepos = selectedReposData?.repos || [];

  // Fetch markdown files for each repository
  useEffect(() => {
    if (selectedRepos.length === 0) {
      setRepoGroups([]);
      setFilesLoading(false);
      return;
    }

    const fetchAllFiles = async () => {
      setFilesLoading(true);
      const groups: RepoGroup[] = [];

      for (const repo of selectedRepos) {
        try {
          const files = await getAllMarkdownFiles(repo);
          if (files.length > 0) {
            groups.push({ repo, files });
          }
        } catch (error) {
          console.error(`Error fetching files for ${repo}:`, error);
        }
      }

      setRepoGroups(groups);
      setFilesLoading(false);
    };

    fetchAllFiles();
  }, [selectedRepos]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('dashboardViewMode') as ViewMode;
    if (savedViewMode === 'list' || savedViewMode === 'card') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('dashboardViewMode', mode);
  };

  const handleFileClick = (file: MarkdownFile, repo: string) => {
    setSelectedFile({ file, repo });
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
  };

  if (reposLoading || filesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">
          {reposLoading ? 'Loading repositories...' : 'Loading markdown files...'}
        </div>
      </div>
    );
  }

  if (selectedRepos.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold mb-4">No Repositories Selected</h2>
        <p className="text-muted-foreground mb-6">
          Please select at least one repository in settings to start viewing content.
        </p>
        <Link to="/admin/settings">
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }

  if (repoGroups.length === 0 && !filesLoading) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold mb-4">No Markdown Files Found</h2>
        <p className="text-muted-foreground">
          No markdown files (.md, .markdown) were found in your selected repositories.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with view toggle */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
          >
            <ListIcon className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('card')}
          >
            <GridIcon className="h-4 w-4 mr-2" />
            Cards
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="space-y-8">
          {repoGroups.map((group) => (
            <div key={group.repo}>
              <h3 className="text-xl font-semibold mb-4">{group.repo}</h3>
              <div className="border rounded-lg divide-y">
                {group.files.map((file) => (
                  <button
                    key={`${group.repo}-${file.path}`}
                    onClick={() => handleFileClick(file, group.repo)}
                    className="w-full p-4 hover:bg-muted flex items-center gap-3 text-left transition-colors"
                  >
                    <FileTextIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-sm text-muted-foreground truncate">{file.path}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {repoGroups.map((group) => (
            <Card key={group.repo} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{group.repo}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2">
                  {group.files.slice(0, 5).map((file) => (
                    <button
                      key={`${group.repo}-${file.path}`}
                      onClick={() => handleFileClick(file, group.repo)}
                      className="w-full p-3 hover:bg-muted rounded-md flex items-center gap-2 text-left transition-colors"
                    >
                      <FileTextIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{file.path}</div>
                      </div>
                    </button>
                  ))}
                  {group.files.length > 5 && (
                    <div className="text-sm text-muted-foreground pt-2">
                      +{group.files.length - 5} more file{group.files.length - 5 !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Editor */}
      {selectedFile && (
        <Modal
          isOpen={!!selectedFile}
          onClose={handleCloseModal}
          title={`${selectedFile.file.name} - ${selectedFile.repo}`}
          size="xl"
        >
          <MarkdownEditor
            repo={selectedFile.repo}
            file={{
              name: selectedFile.file.name,
              path: selectedFile.file.path,
              sha: selectedFile.file.sha,
              type: 'file',
            }}
            onClose={handleCloseModal}
          />
        </Modal>
      )}
    </div>
  );
}
