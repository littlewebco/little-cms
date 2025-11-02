import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getAllMarkdownFiles, type MarkdownFile, getFileFrontMatter } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  FolderIcon, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CategoryInfo {
  name: string;
  count: number;
  posts: Array<{ repo: string; path: string; title: string }>;
}

export default function CategoryManager() {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [deleteCategory, setDeleteCategory] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch selected repositories
  const { data: selectedReposData, isLoading: reposLoading } = useQuery({
    queryKey: ['repos', 'selected'],
    queryFn: () => api.repos.selected(),
  });

  const selectedRepos = selectedReposData?.repos || [];

  // Fetch categories by listing folders in /posts directory
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', 'folders', selectedRepos],
    queryFn: async () => {
      if (selectedRepos.length === 0) return new Map<string, CategoryInfo>();

      const categoryMap = new Map<string, CategoryInfo>();

      for (const repo of selectedRepos) {
        try {
          // List /posts directory to get category folders
          const postsDir = await api.content.list(repo, 'posts') as Array<{ name: string; type: string; path: string }>;
          
          // Process each item in /posts
          for (const item of postsDir) {
            if (item.type === 'dir') {
              // This is a category folder
              const categoryName = item.name;
              
              if (!categoryMap.has(categoryName)) {
                categoryMap.set(categoryName, {
                  name: categoryName,
                  count: 0,
                  posts: [],
                });
              }

              const catInfo = categoryMap.get(categoryName)!;
              
              // Get all files in this category folder
              try {
                const categoryFiles = await getAllMarkdownFiles(repo, item.path);
                for (const file of categoryFiles) {
                  catInfo.count++;
                  
                  // Get title from front matter
                  try {
                    const frontMatter = await getFileFrontMatter(repo, file.path);
                    const title = frontMatter.title || frontMatter.Title || file.name.replace(/\.md$/, '');
                    catInfo.posts.push({
                      repo,
                      path: file.path,
                      title,
                    });
                  } catch {
                    catInfo.posts.push({
                      repo,
                      path: file.path,
                      title: file.name.replace(/\.md$/, ''),
                    });
                  }
                }
              } catch (error) {
                console.error(`Error fetching files for category ${categoryName}:`, error);
              }
            } else if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.markdown'))) {
              // Files directly in /posts are "uncategorized"
              if (!categoryMap.has('uncategorized')) {
                categoryMap.set('uncategorized', {
                  name: 'uncategorized',
                  count: 0,
                  posts: [],
                });
              }
              
              const catInfo = categoryMap.get('uncategorized')!;
              catInfo.count++;
              
              try {
                const frontMatter = await getFileFrontMatter(repo, item.path);
                const title = frontMatter.title || frontMatter.Title || item.name.replace(/\.md$/, '');
                catInfo.posts.push({
                  repo,
                  path: item.path,
                  title,
                });
              } catch {
                catInfo.posts.push({
                  repo,
                  path: item.path,
                  title: item.name.replace(/\.md$/, ''),
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching categories for ${repo}:`, error);
        }
      }

      return categoryMap;
    },
    enabled: selectedRepos.length > 0,
  });

  const categories = categoriesData || new Map<string, CategoryInfo>();

  const categoryList = useMemo(() => {
    return Array.from(categories.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [categories]);

  // Mutation to move a file from one folder to another
  const moveFileMutation = useMutation({
    mutationFn: async ({ 
      repo, 
      oldPath, 
      newPath 
    }: { 
      repo: string; 
      oldPath: string; 
      newPath: string;
    }) => {
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

      // Parse front matter and update category
      const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      let frontMatter: Record<string, any> = {};
      let body = content;

      if (frontMatterMatch) {
        const frontMatterText = frontMatterMatch[1];
        body = frontMatterMatch[2];
        
        // Parse front matter
        frontMatterText.split('\n').forEach((line) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            // Try to parse as number or boolean
            if (value === 'true') {
              frontMatter[key] = true;
            } else if (value === 'false') {
              frontMatter[key] = false;
            } else if (!isNaN(Number(value)) && value !== '') {
              frontMatter[key] = Number(value);
            } else {
              // Remove quotes if present
              value = value.replace(/^["']|["']$/g, '');
              frontMatter[key] = value;
            }
          }
        });
      }

      // Extract category from new path
      const pathParts = newPath.split('/');
      let categoryFromPath: string | undefined;
      
      if (pathParts.length > 2 && pathParts[0] === 'posts') {
        // File is in a category folder: posts/category/filename.md
        categoryFromPath = pathParts[1];
      }

      // Update category in front matter
      if (categoryFromPath) {
        frontMatter.category = categoryFromPath;
      } else {
        // Remove category if file is in root posts folder
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

      const updatedContent = `---
${frontMatterLines.join('\n')}
---

${body}`;

      // Create file in new location with updated front matter
      await api.content.create(repo, newPath, updatedContent, `Move file: ${oldPath} → ${newPath}`);
      
      // Delete old file
      await api.content.delete(repo, oldPath, `Move file: ${oldPath} → ${newPath}`);
    },
  });

  // Mutation to rename category folder (move all files)
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const categoryInfo = categories.get(oldName);
      if (!categoryInfo) return;

      // Move all files from old folder to new folder
      const moves = categoryInfo.posts.map(post => {
        const oldPath = post.path;
        const fileName = oldPath.split('/').pop() || '';
        const newPath = `posts/${newName}/${fileName}`;
        
        return moveFileMutation.mutateAsync({
          repo: post.repo,
          oldPath,
          newPath,
        });
      });

      await Promise.all(moves);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
      setEditingCategory(null);
      setEditCategoryName('');
    },
  });

  // Mutation to delete category folder (move files to /posts)
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      const categoryInfo = categories.get(categoryName);
      if (!categoryInfo) return;

      // Move all files from category folder to /posts (uncategorized)
      const moves = categoryInfo.posts.map(post => {
        const oldPath = post.path;
        const fileName = oldPath.split('/').pop() || '';
        const newPath = `posts/${fileName}`;
        
        return moveFileMutation.mutateAsync({
          repo: post.repo,
          oldPath,
          newPath,
        });
      });

      await Promise.all(moves);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
      setDeleteCategory(null);
    },
  });

  // Mutation to create a new category folder
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      if (selectedRepos.length === 0) return;
      
      // Create .gitkeep file to create the folder
      const folderPath = `posts/${categoryName}/.gitkeep`;
      const content = '# This file keeps the directory in Git\n';
      
      // Create folder in all selected repos
      const creations = selectedRepos.map(repo => 
        api.content.create(repo, folderPath, content, `Create category folder: ${categoryName}`)
      );
      
      await Promise.all(creations);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
      setNewCategoryName('');
    },
  });

  const handleStartEdit = (categoryName: string) => {
    setEditingCategory(categoryName);
    setEditCategoryName(categoryName);
  };

  const handleSaveEdit = () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    
    if (editCategoryName.trim() === editingCategory) {
      setEditingCategory(null);
      setEditCategoryName('');
      return;
    }

    renameCategoryMutation.mutate({
      oldName: editingCategory,
      newName: editCategoryName.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditCategoryName('');
  };

  const handleDelete = (categoryName: string) => {
    setDeleteCategory(categoryName);
  };

  const handleConfirmDelete = () => {
    if (!deleteCategory) return;
    deleteCategoryMutation.mutate(deleteCategory);
  };

  if (reposLoading || categoriesLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground">Loading categories...</div>
        </CardContent>
      </Card>
    );
  }

  if (selectedRepos.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <p>Please select at least one repository in settings to manage categories.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Manage post categories. Categories are folders in the /posts directory. Rename folders to rename categories, or delete folders to move posts to uncategorized.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new category */}
          <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/50">
            <FolderIcon className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="New category name (folder name)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) {
                  createCategoryMutation.mutate(newCategoryName.trim());
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (newCategoryName.trim()) {
                  createCategoryMutation.mutate(newCategoryName.trim());
                }
              }}
              disabled={createCategoryMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              {createCategoryMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>

          {/* Category list */}
          {categoryList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No categories found. Create posts and assign categories to see them here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryList.map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    {editingCategory === category.name ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={renameCategoryMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <FolderIcon className="w-5 h-5 text-primary" />
                          <span className="font-semibold">{category.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({category.count} {category.count === 1 ? 'post' : 'posts'})
                          </span>
                        </div>
                        {category.posts.length > 0 && (
                          <div className="text-sm text-muted-foreground ml-7">
                            {category.posts.slice(0, 3).map((post, idx) => (
                              <span key={idx}>
                                {idx > 0 && ', '}
                                {post.title}
                              </span>
                            ))}
                            {category.posts.length > 3 && ` and ${category.posts.length - 3} more...`}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {editingCategory !== category.name && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(category.name)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {category.name !== 'uncategorized' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(category.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteCategory} onOpenChange={(open) => !open && setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{deleteCategory}"? 
              All posts in this category will be moved to "uncategorized". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

