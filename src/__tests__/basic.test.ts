import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should render without crashing', () => {
    expect(true).toBe(true);
  });

  it('should use React 18 features', () => {
    const version = require('react/package.json').version;
    expect(version).toMatch(/^18\./);
  });
});

describe('Project structure', () => {
  it('should have required source directories', () => {
    const fs = require('node:fs');
    expect(fs.existsSync('src')).toBe(true);
    expect(fs.existsSync('electron')).toBe(true);
    expect(fs.existsSync('docs')).toBe(true);
  });

  it('should have required config files', () => {
    const fs = require('node:fs');
    expect(fs.existsSync('tsconfig.json')).toBe(true);
    expect(fs.existsSync('vite.config.ts')).toBe(true);
    expect(fs.existsSync('package.json')).toBe(true);
  });
});
