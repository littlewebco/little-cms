import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import FileBrowser from '@/components/file-browser/FileBrowser';
import MarkdownEditor from '@/components/editor/MarkdownEditor';

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

export default function ContentPage() {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitHubFile | null>(null);

  // Get selected repositories
  const { data: selectedReposData } = useQuery({
    queryKey: ['repos', 'selected'],
    queryFn: () => api.repos.selected(),
  });

  const selectedRepos = selectedReposData?.repos || [];

  if (selectedRepos.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">No Repositories Selected</h2>
        <p className="text-muted-foreground">
          Please select at least one repository in the dashboard to start editing content.
        </p>
      </div>
    );
  }

  if (!selectedRepo) {
    return (
      <div>
        <h2 className="text-3xl font-bold mb-6">Content</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Repository:</label>
          <select
            value={selectedRepo || ''}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="">Choose a repository...</option>
            {selectedRepos.map((repo: string) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-4">
      {/* File Browser */}
      <div className="w-80 flex-shrink-0">
        <FileBrowser
          repo={selectedRepo}
          onFileSelect={(file) => {
            if (file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
              setSelectedFile(file);
            } else {
              alert('Only markdown files (.md, .markdown) can be edited');
            }
          }}
        />
      </div>

      {/* Editor */}
      <div className="flex-1">
        {selectedFile ? (
          <MarkdownEditor
            repo={selectedRepo}
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center border rounded-lg bg-muted/30">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No file selected</p>
              <p className="text-sm">Select a markdown file from the browser to start editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

