module.exports = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    workerName: 'little-cms',
  },
  repos: [
    {
      name: 'blog',
      owner: 'your-username',
      repo: 'your-blog-repo',
      branch: 'main',
      collections: [
        {
          name: 'posts',
          label: 'Blog Posts',
          folder: 'posts',
          create: true,
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'date', label: 'Date', widget: 'datetime' },
            { name: 'body', label: 'Body', widget: 'markdown' }
          ]
        }
      ]
    }
  ],
  features: {
    embeds: true,
    api: true,
    preview: true,
  }
};
