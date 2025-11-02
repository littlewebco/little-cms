#!/usr/bin/env node

/**
 * LittleCMS CLI Entry Point
 */
import { init } from '../src/cli/init.ts';
import { setup } from '../src/cli/setup.ts';

const command = process.argv[2];

switch (command) {
  case 'init':
    await init();
    break;
  case 'setup':
    await setup();
    break;
  case 'build':
    console.log('Build command coming soon');
    break;
  case 'deploy':
    console.log('Deploy command coming soon');
    break;
  default:
    console.log('LittleCMS CLI');
    console.log('Usage: little-cms [command]');
    console.log('');
    console.log('Commands:');
    console.log('  init    Initialize a new LittleCMS project');
    console.log('  setup   Interactive setup wizard (recommended)');
    console.log('  build   Build the admin UI and worker');
    console.log('  deploy  Deploy to Cloudflare Workers');
    process.exit(1);
}
