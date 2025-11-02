import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileIcon, FolderIcon, FileTextIcon, Plus, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [currentPath, setCurrentPath] = useState('posts');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['content', repo, currentPath],
    queryFn: async () => {
      const result = await api.content.list(repo, currentPath || 'posts');
      return result as GitHubFile[];
    },
    enabled: !!repo,
  });

  const files = (data as GitHubFile[]) || [];

  const createFileMutation = useMutation({
    mutationFn: async ({ path, content, message }: { path: string; content: string; message: string }) => {
      return api.content.create(repo, path, content, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', repo, currentPath] });
      queryClient.invalidateQueries({ queryKey: ['content', repo] });
    },
  });

  const handleFileClick = (file: GitHubFile) => {
    if (file.type === 'dir') {
      setCurrentPath(file.path);
    } else {
      onFileSelect(file);
    }
  };

  const handlePathClick = (index: number) => {
    const parts = currentPath.split('/').slice(0, index + 1);
    const newPath = parts.join('/');
    // Ensure we don't go outside /posts
    if (newPath.startsWith('posts') || newPath === 'posts') {
      setCurrentPath(newPath);
    } else {
      setCurrentPath('posts');
    }
  };

  const handleCreateFile = () => {
    const fileName = prompt('Enter file name (e.g., my-post.md):');
    if (!fileName) return;
    
    // Ensure .md extension
    const finalFileName = fileName.endsWith('.md') || fileName.endsWith('.markdown') 
      ? fileName 
      : `${fileName}.md`;
    
    const filePath = currentPath === 'posts' 
      ? `posts/${finalFileName}`
      : `${currentPath}/${finalFileName}`;
    
    const message = prompt('Enter commit message:', `Create ${finalFileName}`);
    if (!message) return;

    const defaultContent = `---
title: ${fileName.replace('.md', '').replace(/-/g, ' ')}
date: ${new Date().toISOString().split('T')[0]}
---

# ${fileName.replace('.md', '').replace(/-/g, ' ')}

Start writing your content here...
`;

    createFileMutation.mutate({
      path: filePath,
      content: defaultContent,
      message,
    });
  };

  const handleCreateFolder = () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    
    // GitHub doesn't support empty directories, so we create a .gitkeep file
    const folderPath = currentPath === 'posts' 
      ? `posts/${folderName}/.gitkeep`
      : `${currentPath}/${folderName}/.gitkeep`;
    
    const message = prompt('Enter commit message:', `Create folder ${folderName}`);
    if (!message) return;

    createFileMutation.mutate({
      path: folderPath,
      content: '# This file keeps the directory in Git\n',
      message,
    });
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  // Ensure path starts with 'posts'
  const safePathParts = pathParts[0] === 'posts' ? pathParts : ['posts', ...pathParts];

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
      {/* Header with actions */}
      <div className="p-3 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateFile}
              disabled={createFileMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-1" />
              New File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateFolder}
              disabled={createFileMutation.isPending}
            >
              <FolderPlus className="w-4 h-4 mr-1" />
              New Folder
            </Button>
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentPath('posts')}
            className="hover:text-primary font-medium"
          >
            {repo} / posts
          </button>
          {safePathParts.slice(1).map((part, index) => (
            <span key={index} className="flex items-center gap-2">
              <span>/</span>
              <button
                onClick={() => handlePathClick(index + 1)}
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
            <p>No files found in /posts</p>
            <p className="text-xs mt-2">Use "New File" or "New Folder" to create content</p>
          </div>
        ) : (
          <div className="divide-y">
            {files
              .filter(file => file.name !== '.gitkeep') // Hide .gitkeep files from display
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

