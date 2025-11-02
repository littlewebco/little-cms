export default function Dashboard() {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Repositories</h3>
          <p className="text-muted-foreground">Manage your Git repositories</p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Content</h3>
          <p className="text-muted-foreground">Browse and edit content</p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Settings</h3>
          <p className="text-muted-foreground">Configure your CMS</p>
        </div>
      </div>
      <div className="mt-8 p-6 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Configure your repositories in little-cms.config.js</li>
          <li>Set up GitHub OAuth credentials</li>
          <li>Start managing your content!</li>
        </ol>
      </div>
    </div>
  );
}

