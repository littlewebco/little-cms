import RepositorySelector from './RepositorySelector';

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Settings</h2>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-4">Repository Access</h3>
          <p className="text-muted-foreground mb-4">
            Select which repositories LittleCMS can access. Even though the GitHub App installation grants access to all repos,
            only selected repositories will be accessible through the CMS.
          </p>
          <RepositorySelector />
        </div>
      </div>
    </div>
  );
}

