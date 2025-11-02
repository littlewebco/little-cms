import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileIcon, FolderIcon, FileTextIcon } from 'lucide-react';

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  download_url: string | null;
}

interface FileBrowserProps {
  repo: string;
  onFileSelect: (file: GitHubFile) => void;
}

export default function FileBrowser({ repo, onFileSelect }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['content', repo, currentPath],
    queryFn: async () => {
      const result = await api.content.list(repo, currentPath || undefined);
      return result as GitHubFile[];
    },
    enabled: !!repo,
  });

  const files = (data as GitHubFile[]) || [];

  const handleFileClick = (file: GitHubFile) => {
    if (file.type === 'dir') {
      setCurrentPath(file.path);
    } else {
      onFileSelect(file);
    }
  };

  const handlePathClick = (index: number) => {
    const parts = currentPath.split('/').slice(0, index + 1);
    setCurrentPath(parts.join('/'));
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground">Loading files...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading files: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border rounded-lg">
      {/* Breadcrumb */}
      <div className="p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentPath('')}
            className="hover:text-primary font-medium"
          >
            {repo}
          </button>
          {pathParts.map((part, index) => (
            <span key={index} className="flex items-center gap-2">
              <span>/</span>
              <button
                onClick={() => handlePathClick(index)}
                className="hover:text-primary font-medium"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No files found
          </div>
        ) : (
          <div className="divide-y">
            {files
              .sort((a, b) => {
                // Directories first
                if (a.type !== b.type) {
                  return a.type === 'dir' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              })
              .map((file) => (
                <button
                  key={file.sha}
                  onClick={() => handleFileClick(file)}
                  className="w-full p-3 hover:bg-muted flex items-center gap-3 text-left transition-colors"
                >
                  {file.type === 'dir' ? (
                    <FolderIcon className="w-5 h-5 text-blue-500" />
                  ) : file.name.endsWith('.md') || file.name.endsWith('.markdown') ? (
                    <FileTextIcon className="w-5 h-5 text-purple-500" />
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="flex-1 font-medium">{file.name}</span>
                  {file.type === 'file' && (
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

