import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Save, Eye, Code, Trash2 } from 'lucide-react';

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

interface FrontMatter {
  [key: string]: string | number | boolean;
}

interface MarkdownEditorProps {
  repo: string;
  file: GitHubFile;
  onClose?: () => void;
}

// Parse front matter from markdown
function parseFrontMatter(content: string): { frontMatter: FrontMatter; body: string } {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, body: content };
  }

  const frontMatterText = match[1];
  const body = match[2];

  const frontMatter: FrontMatter = {};
  frontMatterText.split('\n').forEach((line) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      // Try to parse as number or boolean
      if (value === 'true') {
        frontMatter[key] = true;
      } else if (value === 'false') {
        frontMatter[key] = false;
      } else if (!isNaN(Number(value))) {
        frontMatter[key] = Number(value);
      } else {
        // Remove quotes if present
        frontMatter[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  });

  return { frontMatter, body };
}

// Serialize front matter back to YAML
function serializeFrontMatter(frontMatter: FrontMatter, body: string): string {
  const frontMatterLines = Object.entries(frontMatter).map(([key, value]) => {
    if (typeof value === 'string') {
      return `${key}: "${value}"`;
    }
    return `${key}: ${value}`;
  });

  if (frontMatterLines.length === 0) {
    return body;
  }

  return `---\n${frontMatterLines.join('\n')}\n---\n${body}`;
}

export default function MarkdownEditor({ repo, file, onClose }: MarkdownEditorProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [frontMatter, setFrontMatter] = useState<FrontMatter>({});
  const [body, setBody] = useState('');
  const [originalContent, setOriginalContent] = useState('');

  // Fetch file content
  const { data, isLoading, error } = useQuery({
    queryKey: ['content', repo, file.path],
    queryFn: () => api.content.get(repo, file.path),
    enabled: !!file.path,
  });

  // Fetch preview HTML from worker
  const { data: previewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: ['preview', repo, body],
    queryFn: () => api.preview.render(body, repo, file.path),
    enabled: viewMode === 'preview' && body.length > 0,
  });

  const previewHtml = previewData?.html || '';

  useEffect(() => {
    if (data) {
      const fileData = data as any;
      let content = '';
      
      // Decode base64 content if needed
      if (fileData.content) {
        try {
          // GitHub API returns base64 encoded content
          content = atob(fileData.content);
        } catch {
          content = fileData.content;
        }
      } else if (fileData.download_url) {
        // If no content field, fetch from download_url
        fetch(fileData.download_url)
          .then(res => res.text())
          .then(text => {
            const parsed = parseFrontMatter(text);
            setFrontMatter(parsed.frontMatter);
            setBody(parsed.body);
            setOriginalContent(text);
          })
          .catch(err => {
            console.error('Error fetching file:', err);
          });
        return;
      }

      if (content) {
        const parsed = parseFrontMatter(content);
        setFrontMatter(parsed.frontMatter);
        setBody(parsed.body);
        setOriginalContent(content);
      }
    }
  }, [data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ content, message }: { content: string; message: string }) => {
      return api.content.update(repo, file.path, content, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', repo, file.path] });
      queryClient.invalidateQueries({ queryKey: ['content', repo] });
      alert('File saved successfully!');
    },
    onError: (error) => {
      alert(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (message: string) => {
      return api.content.delete(repo, file.path, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', repo] });
      alert('File deleted successfully!');
      if (onClose) {
        onClose();
      }
    },
    onError: (error) => {
      alert(`Error deleting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleSave = () => {
    const message = prompt('Enter commit message:', `Update ${file.name}`);
    if (!message) return;

    const content = serializeFrontMatter(frontMatter, body);
    saveMutation.mutate({ content, message });
  };

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete "${file.name}"? This action cannot be undone.`)) {
      return;
    }

    const message = prompt('Enter commit message:', `Delete ${file.name}`);
    if (!message) return;

    deleteMutation.mutate(message);
  };

  const handleFrontMatterChange = (key: string, value: string | number | boolean) => {
    setFrontMatter({ ...frontMatter, [key]: value });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading file: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const hasChanges = serializeFrontMatter(frontMatter, body) !== originalContent;

  return (
    <div className="h-full flex flex-col border rounded-lg">
      {/* Toolbar */}
      <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{file.name}</span>
          {hasChanges && (
            <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'edit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('edit')}
          >
            <Code className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('preview')}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Front Matter Sidebar */}
        {viewMode === 'edit' && (
          <div className="w-64 border-r p-4 overflow-y-auto bg-muted/30">
            <h3 className="font-semibold mb-4">Front Matter</h3>
            <div className="space-y-3">
              {Object.entries(frontMatter).map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {key}
                  </label>
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      // Try to parse as number or boolean
                      if (newValue === 'true') {
                        handleFrontMatterChange(key, true);
                      } else if (newValue === 'false') {
                        handleFrontMatterChange(key, false);
                      } else if (!isNaN(Number(newValue))) {
                        handleFrontMatterChange(key, Number(newValue));
                      } else {
                        handleFrontMatterChange(key, newValue);
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border rounded bg-background text-foreground border-input"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => {
                  const key = prompt('Field name:');
                  if (key) {
                    handleFrontMatterChange(key, '');
                  }
                }}
              >
                + Add Field
              </Button>
            </div>
          </div>
        )}

        {/* Markdown Editor */}
        {viewMode === 'edit' && (
          <div className="flex-1 flex flex-col">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-sm border-0 resize-none focus:outline-none bg-background text-foreground placeholder:text-muted-foreground"
              placeholder="Start writing markdown..."
            />
          </div>
        )}

        {/* Preview */}
        {viewMode === 'preview' && (
          <div className="flex-1 p-8 overflow-y-auto prose prose-sm max-w-none">
            {isPreviewLoading ? (
              <div className="text-muted-foreground">Rendering preview...</div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
