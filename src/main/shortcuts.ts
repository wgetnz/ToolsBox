import * as fs from 'fs';
import * as path from 'path';
import { AppSettings, Tool } from '../shared/types';
import { buildCommand } from './launcher';

function escapeShellArg(value: string): string {
  if (!value) return "''";
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function escapeCmdArg(value: string): string {
  if (!value) return '""';
  return `"${value.replace(/"/g, '""')}"`;
}

function sanitizeFileName(name: string): string {
  const normalized = name.trim().replace(/[/\\:*?"<>|]/g, '-');
  return normalized || 'LaunchBox Shortcut';
}

function ensureUniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;

  const parsed = path.parse(targetPath);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }

  return path.join(parsed.dir, `${parsed.name} ${Date.now()}${parsed.ext}`);
}

function buildWeblocContent(url: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>${url}</string>
</dict>
</plist>
`;
}

function buildWindowsUrlContent(url: string): string {
  return `[InternetShortcut]
URL=${url}
`;
}

function buildUnixShortcutContent(tool: Tool, settings: AppSettings): string {
  const command = buildCommand(tool, settings);
  const cwd = (command.opts as { cwd?: string }).cwd;
  const shellCommand = [command.cmd, ...command.args].map(escapeShellArg).join(' ');
  const lines = ['#!/bin/bash', 'set -e'];

  if (cwd) {
    lines.push(`cd ${escapeShellArg(cwd)}`);
  }

  lines.push(shellCommand);
  return `${lines.join('\n')}\n`;
}

function buildWindowsShortcutContent(tool: Tool, settings: AppSettings): string {
  const command = buildCommand(tool, settings);
  const cwd = (command.opts as { cwd?: string }).cwd;
  const shellCommand = [command.cmd, ...command.args].map(escapeCmdArg).join(' ');
  const lines = ['@echo off'];

  if (cwd) {
    lines.push(`cd /d ${escapeCmdArg(cwd)}`);
  }

  lines.push(shellCommand);
  return `${lines.join('\r\n')}\r\n`;
}

export function createToolShortcut(
  tool: Tool,
  settings: AppSettings,
  targetDir: string,
  platform: NodeJS.Platform = process.platform
): string {
  fs.mkdirSync(targetDir, { recursive: true });

  const baseName = sanitizeFileName(tool.name);

  if (tool.type === 'url') {
    const extension = platform === 'darwin' ? '.webloc' : '.url';
    const shortcutPath = ensureUniquePath(path.join(targetDir, `${baseName}${extension}`));
    const content = platform === 'darwin'
      ? buildWeblocContent(tool.path)
      : buildWindowsUrlContent(tool.path);
    fs.writeFileSync(shortcutPath, content, 'utf-8');
    return shortcutPath;
  }

  if (platform === 'win32') {
    const shortcutPath = ensureUniquePath(path.join(targetDir, `${baseName}.cmd`));
    fs.writeFileSync(shortcutPath, buildWindowsShortcutContent(tool, settings), 'utf-8');
    return shortcutPath;
  }

  const extension = platform === 'darwin' ? '.command' : '.sh';
  const shortcutPath = ensureUniquePath(path.join(targetDir, `${baseName}${extension}`));
  fs.writeFileSync(shortcutPath, buildUnixShortcutContent(tool, settings), 'utf-8');
  fs.chmodSync(shortcutPath, 0o755);
  return shortcutPath;
}
