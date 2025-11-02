import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import { Label } from '@/components/ui/label';

interface NewPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    date: string;
    slug: string;
    category?: string;
    excerpt?: string;
    feature_image?: string;
    tags?: string[];
    filename: string;
  }) => void;
  defaultPath?: string;
}

/**
 * Convert a string to a URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NewPostDialog({ isOpen, onClose, onCreate, defaultPath = 'posts' }: NewPostDialogProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [category, setCategory] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [feature_image, setFeatureImage] = useState('');
  const [tags, setTags] = useState('');

  // Auto-generate slug from title
  useEffect(() => {
    if (title) {
      setSlug(slugify(title));
    }
  }, [title]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSlug('');
      setDate(formatDate(new Date()));
      setCategory('');
      setExcerpt('');
      setFeatureImage('');
      setTags('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !slug) {
      alert('Title is required');
      return;
    }

    // Generate filename: YYYY-MM-DD-slug.md
    const filename = `${date}-${slug}.md`;

    // Parse tags from comma-separated string
    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onCreate({
      title,
      date,
      slug,
      category: category || undefined,
      excerpt: excerpt || undefined,
      feature_image: feature_image || undefined,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      filename,
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Post" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter post title"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="post-slug"
            required
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            URL-friendly version of the title. Will be used in filename: {date}-{slug || 'slug'}.md
          </p>
        </div>

        <div>
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Technology, Tutorial, News"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="excerpt">Excerpt</Label>
          <textarea
            id="excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A brief description of the post"
            rows={3}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground border-input resize-none"
          />
        </div>

        <div>
          <Label htmlFor="feature_image">Feature Image URL</Label>
          <Input
            id="feature_image"
            type="url"
            value={feature_image}
            onChange={(e) => setFeatureImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="welcome, getting-started, tutorial (comma-separated)"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter tags separated by commas. Example: welcome, getting-started, tutorial
          </p>
        </div>

        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-medium mb-1">Generated Filename:</p>
          <p className="text-xs text-muted-foreground font-mono">
            {defaultPath}/{date}-{slug || 'slug'}.md
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title || !slug}>
            Create Post
          </Button>
        </div>
      </form>
    </Modal>
  );
}

