import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileIcon, FolderIcon, FileTextIcon, Plus, FolderPlus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NewPostDialog from '@/components/post/NewPostDialog';

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
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [draggedItem, setDraggedItem] = useState<GitHubFile | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
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

  // Move file/folder mutation
  const moveFileMutation = useMutation({
    mutationFn: async ({ 
      oldPath, 
      newPath,
      isFolder 
    }: { 
      oldPath: string; 
      newPath: string;
      isFolder: boolean;
    }) => {
      if (isFolder) {
        // Move entire folder recursively
        return moveFolderRecursively(oldPath, newPath);
      } else {
        // Move single file
        return moveSingleFile(oldPath, newPath);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', repo] });
      queryClient.invalidateQueries({ queryKey: ['content', repo, currentPath] });
      setDraggedItem(null);
      setDragOverPath(null);
    },
    onError: (error) => {
      alert(`Error moving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDraggedItem(null);
      setDragOverPath(null);
    },
  });

  // Move a single file (updates front matter for markdown files)
  const moveSingleFile = async (oldPath: string, newPath: string) => {
    // Get current file content
    const fileData = await api.content.get(repo, oldPath) as any;
    let content = '';
    
    if (fileData.content) {
      try {
        content = atob(fileData.content);
      } catch {
        content = fileData.content;
      }
    } else if (fileData.download_url) {
      const response = await fetch(fileData.download_url);
      content = await response.text();
    }

    // If it's a markdown file, update front matter with category
    if (oldPath.endsWith('.md') || oldPath.endsWith('.markdown')) {
      const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      let frontMatter: Record<string, any> = {};
      let body = content;

      if (frontMatterMatch) {
        const frontMatterText = frontMatterMatch[1];
        body = frontMatterMatch[2];
        
        // Parse front matter (handle arrays too)
        const lines = frontMatterText.split('\n');
        let i = 0;
        while (i < lines.length) {
          const line = lines[i].trim();
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            
            // Check if this is an array (next line starts with -)
            if (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
              // Parse YAML array
              const array: string[] = [];
              i++; // Move to first array item
              while (i < lines.length && lines[i].trim().startsWith('-')) {
                const item = lines[i].trim().substring(1).trim();
                array.push(item.replace(/^["']|["']$/g, ''));
                i++;
              }
              frontMatter[key] = array;
              i--; // Adjust for loop increment
            } else {
              // Parse as simple value
              if (value === 'true') {
                frontMatter[key] = true;
              } else if (value === 'false') {
                frontMatter[key] = false;
              } else if (!isNaN(Number(value)) && value !== '') {
                frontMatter[key] = Number(value);
              } else {
                frontMatter[key] = value.replace(/^["']|["']$/g, '');
              }
            }
          }
          i++;
        }
      }

      // Extract category from new path
      const pathParts = newPath.split('/');
      let categoryFromPath: string | undefined;
      
      if (pathParts.length > 2 && pathParts[0] === 'posts') {
        categoryFromPath = pathParts[1];
      }

      // Update category in front matter
      if (categoryFromPath) {
        frontMatter.category = categoryFromPath;
      } else {
        delete frontMatter.category;
      }

      // Rebuild front matter
      const frontMatterLines: string[] = [];
      Object.entries(frontMatter).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          frontMatterLines.push(`${key}:`);
          value.forEach(item => {
            frontMatterLines.push(`  - ${item}`);
          });
        } else if (typeof value === 'string' && (value.includes(':') || value.includes("'") || value.includes('"'))) {
          frontMatterLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
        } else {
          frontMatterLines.push(`${key}: ${value}`);
        }
      });

      content = `---
${frontMatterLines.join('\n')}
---

${body}`;
    }

    // Create file in new location
    await api.content.create(repo, newPath, content, `Move file: ${oldPath} → ${newPath}`);
    
    // Delete old file
    await api.content.delete(repo, oldPath, `Move file: ${oldPath} → ${newPath}`);
  };

  // Move folder recursively
  const moveFolderRecursively = async (oldFolderPath: string, newFolderPath: string) => {
    // List all files in the folder
    const files = await api.content.list(repo, oldFolderPath) as GitHubFile[];
    
    // Move each file
    for (const file of files) {
      if (file.type === 'file') {
        const oldFilePath = file.path;
        const fileName = file.name;
        const newFilePath = `${newFolderPath}/${fileName}`;
        
        await moveSingleFile(oldFilePath, newFilePath);
      } else if (file.type === 'dir') {
        // Recursively move subdirectories
        const oldSubFolderPath = file.path;
        const folderName = file.name;
        const newSubFolderPath = `${newFolderPath}/${folderName}`;
        
        await moveFolderRecursively(oldSubFolderPath, newSubFolderPath);
      }
    }
  };

  const handleFileClick = (file: GitHubFile) => {
    // Don't handle click if we're dragging
    if (draggedItem) return;
    
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
    setShowNewPostDialog(true);
  };

  const handleCreatePost = (data: {
    title: string;
    date: string;
    slug: string;
    category?: string;
    excerpt?: string;
    feature_image?: string;
    tags?: string[];
    filename: string;
  }) => {
    const filePath = currentPath === 'posts' 
      ? `posts/${data.filename}`
      : `${currentPath}/${data.filename}`;

    // Extract category from path
    // Path format: posts/category/filename.md or posts/filename.md
    const pathParts = filePath.split('/');
    let categoryFromPath: string | undefined;
    
    if (pathParts.length > 2 && pathParts[0] === 'posts') {
      // File is in a category folder: posts/category/filename.md
      categoryFromPath = pathParts[1];
    }

    // Build front matter with all fields
    const frontMatter: Record<string, any> = {
      title: data.title,
      date: data.date,
    };

    // Use category from path if available, otherwise use form data
    if (categoryFromPath) {
      frontMatter.category = categoryFromPath;
    } else if (data.category) {
      frontMatter.category = data.category;
    }
    
    if (data.excerpt) {
      frontMatter.excerpt = data.excerpt;
    }
    if (data.feature_image) {
      frontMatter.feature_image = data.feature_image;
    }
    if (data.tags && data.tags.length > 0) {
      frontMatter.tags = data.tags;
    }

    // Format front matter as YAML
    const frontMatterLines: string[] = [];
    Object.entries(frontMatter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Format arrays as YAML list
        frontMatterLines.push(`${key}:`);
        value.forEach(item => {
          frontMatterLines.push(`  - ${item}`);
        });
      } else if (typeof value === 'string' && (value.includes(':') || value.includes("'") || value.includes('"'))) {
        // Escape strings that need quotes
        frontMatterLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    });

    const frontMatterString = frontMatterLines.join('\n');

    const defaultContent = `---
${frontMatterString}
---

# ${data.title}

${data.excerpt || 'Start writing your content here...'}
`;

    const message = `Create post: ${data.title}`;

    createFileMutation.mutate({
      path: filePath,
      content: defaultContent,
      message,
    }, {
      onSuccess: () => {
        // Open the newly created file in the editor
        const newFile: GitHubFile = {
          name: data.filename,
          path: filePath,
          sha: '', // Will be updated after creation
          size: 0,
          type: 'file',
          download_url: null,
        };
        // Wait a bit for the file to be created, then select it
        setTimeout(() => {
          onFileSelect(newFile);
        }, 500);
      },
    });
  };

  const handleDragStart = (e: React.DragEvent, file: GitHubFile) => {
    setDraggedItem(file);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.path);
  };

  const handleDragOver = (e: React.DragEvent, dropPath?: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (dropPath !== undefined) {
      setDragOverPath(dropPath);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPath(null);
  };

  const handleDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem) return;

    const draggedPath = draggedItem.path;
    
    // Don't allow dropping on self
    if (draggedPath === targetPath) {
      setDraggedItem(null);
      setDragOverPath(null);
      return;
    }

    // Don't allow dropping a folder into itself or its children
    if (draggedItem.type === 'dir' && targetPath.startsWith(draggedPath + '/')) {
      alert('Cannot move a folder into itself');
      setDraggedItem(null);
      setDragOverPath(null);
      return;
    }

    // Determine new path
    let newPath: string;
    const fileName = draggedItem.name;
    
    if (targetPath === currentPath) {
      // Dropping in current directory
      newPath = `${currentPath}/${fileName}`;
    } else {
      // Dropping on a folder
      newPath = `${targetPath}/${fileName}`;
    }

    // Validate paths
    if (!newPath.startsWith('posts/') && newPath !== 'posts') {
      alert('All files must be within the /posts directory');
      setDraggedItem(null);
      setDragOverPath(null);
      return;
    }

    // Move the file/folder
    moveFileMutation.mutate({
      oldPath: draggedPath,
      newPath,
      isFolder: draggedItem.type === 'dir',
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverPath(null);
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
    <>
      <NewPostDialog
        isOpen={showNewPostDialog}
        onClose={() => setShowNewPostDialog(false)}
        onCreate={handleCreatePost}
        defaultPath={currentPath}
      />
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
      <div 
        className="flex-1 overflow-y-auto"
        onDragOver={(e) => handleDragOver(e, currentPath)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, currentPath)}
      >
        {files.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No files found in /posts</p>
            <p className="text-xs mt-2">Use "New File" or "New Folder" to create content</p>
            {dragOverPath === currentPath && (
              <div className="mt-4 p-4 border-2 border-dashed border-primary rounded-lg bg-primary/10">
                Drop here to move to this folder
              </div>
            )}
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
                <div
                  key={file.sha}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, file.type === 'dir' ? file.path : undefined)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => {
                    if (file.type === 'dir') {
                      handleDrop(e, file.path);
                    }
                  }}
                  className={`
                    w-full p-3 flex items-center gap-3 text-left transition-colors
                    ${draggedItem?.path === file.path ? 'opacity-50' : ''}
                    ${dragOverPath === file.path && file.type === 'dir' ? 'bg-primary/20 border-2 border-primary' : 'hover:bg-muted'}
                    ${moveFileMutation.isPending ? 'opacity-50 cursor-wait' : 'cursor-move'}
                  `}
                  onClick={(e) => {
                    // Prevent click if dragging or if move is in progress
                    if (draggedItem || moveFileMutation.isPending) return;
                    handleFileClick(file);
                  }}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {file.type === 'dir' ? (
                    <FolderIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  ) : file.name.endsWith('.md') || file.name.endsWith('.markdown') ? (
                    <FileTextIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="flex-1 font-medium">{file.name}</span>
                  {file.type === 'file' && (
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                  {dragOverPath === file.path && file.type === 'dir' && (
                    <span className="text-xs text-primary font-medium">Drop here</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

