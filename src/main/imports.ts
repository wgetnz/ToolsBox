import * as fs from 'fs';
import * as path from 'path';

export function isSupportedImportFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith('.app') ||
    lower.endsWith('.jar') ||
    lower.endsWith('.py') ||
    lower.endsWith('.sh') ||
    lower.endsWith('.bash') ||
    lower.endsWith('.zsh') ||
    lower.endsWith('.bat') ||
    lower.endsWith('.cmd')
  );
}

export function isExecutableFile(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function expandImportItems(items: string[]): string[] {
  const discovered = new Set<string>();

  const visit = (targetPath: string, depth: number): void => {
    if (!targetPath || discovered.has(targetPath)) return;
    if (!fs.existsSync(targetPath)) return;

    let stats: fs.Stats;
    try {
      stats = fs.statSync(targetPath);
    } catch {
      return;
    }

    if (stats.isDirectory()) {
      if (targetPath.toLowerCase().endsWith('.app')) {
        discovered.add(targetPath);
        return;
      }

      if (depth > 2) return;

      try {
        for (const entry of fs.readdirSync(targetPath)) {
          visit(path.join(targetPath, entry), depth + 1);
        }
      } catch {
        return;
      }
      return;
    }

    if (isSupportedImportFile(targetPath) || isExecutableFile(targetPath)) {
      discovered.add(targetPath);
    }
  };

  items.forEach(item => visit(item, 0));
  return Array.from(discovered).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
