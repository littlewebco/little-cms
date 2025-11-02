import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getAllMarkdownFiles, type MarkdownFile, getFileFrontMatter } from '@/lib/utils';
import Modal from '@/components/ui/modal';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import NewPostDialog from '@/components/post/NewPostDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  FileTextIcon, 
  Plus, 
  Search, 
  FolderIcon, 
  CalendarIcon,
  TrendingUp,
  FileEdit,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface PostWithMetadata extends MarkdownFile {
  title?: string;
  date?: string;
  category?: string;
  excerpt?: string;
  feature_image?: string;
  frontMatter?: Record<string, any>;
}

interface RepoGroup {
  repo: string;
  files: PostWithMetadata[];
}

// Parse front matter from markdown file name/path and fetch front matter
async function parsePostMetadata(file: MarkdownFile): Promise<PostWithMetadata> {
  const category = file.path.includes('/') 
    ? file.path.split('/').slice(0, -1).pop() || 'uncategorized'
    : 'uncategorized';
  
  // Extract date from filename if it follows pattern: YYYY-MM-DD-title.md
  const dateMatch = file.name.match(/^(\d{4}-\d{2}-\d{2})-/);
  const date = dateMatch ? dateMatch[1] : undefined;
  
  // Extract title from filename
  const titleFromName = file.name
    .replace(/\.md$/, '')
    .replace(/\.markdown$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  // Fetch front matter to get feature_image and other metadata
  const frontMatter = await getFileFrontMatter(file.repo, file.path);
  
  // Use title from front matter if available, otherwise use filename
  const title = frontMatter.title || frontMatter.Title || titleFromName;
  const feature_image = frontMatter.feature_image || frontMatter.featureImage || frontMatter.FeatureImage;
  const excerpt = frontMatter.excerpt || frontMatter.Excerpt || frontMatter.description || frontMatter.Description;

  return {
    ...file,
    title,
    date: frontMatter.date || frontMatter.Date || date,
    category: frontMatter.category || frontMatter.Category || (category !== 'posts' ? category : 'uncategorized'),
    excerpt,
    feature_image,
    frontMatter,
  };
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ file: MarkdownFile; repo: string } | null>(null);
  const [repoGroups, setRepoGroups] = useState<RepoGroup[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const queryClient = useQueryClient();

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
          const filesWithMetadata = await Promise.all(files.map(parsePostMetadata));
          if (filesWithMetadata.length > 0) {
            groups.push({ repo, files: filesWithMetadata });
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

  // Get all posts across all repos
  const allPosts = useMemo(() => {
    return repoGroups.flatMap(group => 
      group.files.map(file => ({ ...file, repo: group.repo }))
    );
  }, [repoGroups]);

  // Get categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allPosts.forEach(post => {
      if (post.category) {
        cats.add(post.category);
      }
    });
    return Array.from(cats).sort();
  }, [allPosts]);

  // Filter posts by search and category
  const filteredPosts = useMemo(() => {
    let filtered = allPosts;

    if (selectedCategory) {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.name.toLowerCase().includes(query) ||
        post.title?.toLowerCase().includes(query) ||
        post.path.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allPosts, searchQuery, selectedCategory]);

  // Get recent posts (last 10)
  const recentPosts = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => {
        // Sort by date if available, otherwise by name
        if (a.date && b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.name.localeCompare(a.name);
      })
      .slice(0, 10);
  }, [allPosts]);

  // Stats
  const stats = useMemo(() => {
    return {
      totalPosts: allPosts.length,
      totalRepos: selectedRepos.length,
      totalCategories: categories.length,
      recentActivity: recentPosts.length,
    };
  }, [allPosts, selectedRepos, categories, recentPosts]);

  const createFileMutation = useMutation({
    mutationFn: async ({ repo, path, content, message }: { repo: string; path: string; content: string; message: string }) => {
      return api.content.create(repo, path, content, message);
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refresh the file list
      queryClient.invalidateQueries({ queryKey: ['content', variables.repo] });
      queryClient.invalidateQueries({ queryKey: ['repos', 'selected'] });
      // Refetch files for this repo
      setTimeout(() => {
        window.location.reload(); // Reload to see the new file
      }, 1000);
    },
  });

  const handleFileClick = (file: MarkdownFile, repo: string) => {
    setSelectedFile({ file, repo });
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
  };

  const handleCreatePost = () => {
    if (selectedRepos.length === 0) {
      alert('Please select at least one repository in settings first.');
      return;
    }
    setShowNewPostDialog(true);
  };

  const handlePostCreate = (data: {
    title: string;
    date: string;
    slug: string;
    category?: string;
    excerpt?: string;
    feature_image?: string;
    tags?: string[];
    filename: string;
  }) => {
    // Use the first selected repo, or allow user to select if multiple
    const repo = selectedRepos[0];
    
    const filePath = `posts/${data.filename}`;

    // Build front matter with all fields
    const frontMatter: Record<string, any> = {
      title: data.title,
      date: data.date,
    };

    if (data.category) {
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
      repo,
      path: filePath,
      content: defaultContent,
      message,
    });
  };

  if (reposLoading || filesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">
          {reposLoading ? 'Loading repositories...' : 'Loading posts...'}
        </div>
      </div>
    );
  }

  if (selectedRepos.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold mb-4">Welcome to LittleCMS</h2>
        <p className="text-muted-foreground mb-6">
          Get started by selecting repositories in settings.
        </p>
        <Link to="/admin/settings">
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <NewPostDialog
        isOpen={showNewPostDialog}
        onClose={() => setShowNewPostDialog(false)}
        onCreate={handlePostCreate}
        defaultPath="posts"
      />
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Manage your content across {stats.totalRepos} {stats.totalRepos === 1 ? 'repository' : 'repositories'}
          </p>
        </div>
        <Button onClick={handleCreatePost} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPosts}</div>
            <p className="text-xs text-muted-foreground">
              Across all repositories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repositories</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRepos}</div>
            <p className="text-xs text-muted-foreground">
              Active repositories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCategories}</div>
            <p className="text-xs text-muted-foreground">
              Content categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivity}</div>
            <p className="text-xs text-muted-foreground">
              Recent posts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All Categories
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>Your most recently added or updated posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPosts.slice(0, 5).map((post) => (
                <button
                  key={`${post.repo}-${post.path}`}
                  onClick={() => handleFileClick(post, post.repo)}
                  className="w-full p-3 hover:bg-muted rounded-lg flex items-center gap-3 text-left transition-colors"
                >
                  {post.feature_image ? (
                    <div 
                      className="w-12 h-12 rounded-lg flex-shrink-0 bg-cover bg-center border"
                      style={{ backgroundImage: `url(${post.feature_image})` }}
                    />
                  ) : (
                    <FileTextIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{post.title || post.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="truncate">{post.repo}</span>
                      {post.category && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <FolderIcon className="w-3 h-3" />
                            {post.category}
                          </span>
                        </>
                      )}
                      {post.date && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {post.date}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Posts Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">
            {selectedCategory ? `${selectedCategory} Posts` : 'All Posts'}
            {searchQuery && ` matching "${searchQuery}"`}
          </h3>
          <div className="text-sm text-muted-foreground">
            {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileTextIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No posts found</p>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || selectedCategory
                  ? 'Try adjusting your search or filter'
                  : 'Get started by creating your first post'}
              </p>
              {!searchQuery && !selectedCategory && (
                <Button onClick={handleCreatePost}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <Card 
                key={`${post.repo}-${post.path}`}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => handleFileClick(post, post.repo)}
              >
                {post.feature_image && (
                  <div 
                    className="w-full h-48 bg-cover bg-center relative"
                    style={{ backgroundImage: `url(${post.feature_image})` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  </div>
                )}
                <CardHeader className={post.feature_image ? 'pt-4' : ''}>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2 flex-1">
                      {post.title || post.name.replace(/\.md$/, '')}
                    </CardTitle>
                    {!post.feature_image && (
                      <FileTextIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    )}
                  </div>
                  {post.excerpt && (
                    <CardDescription className="line-clamp-2 mt-2">
                      {post.excerpt}
                    </CardDescription>
                  )}
                  {!post.excerpt && (
                    <CardDescription className="line-clamp-2">
                      {post.path}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {post.category && (
                      <div className="flex items-center gap-1">
                        <FolderIcon className="w-4 h-4" />
                        <span>{post.category}</span>
                      </div>
                    )}
                    {post.date && (
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span>{post.date}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground truncate">
                    {post.repo}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
    </>
  );
}
