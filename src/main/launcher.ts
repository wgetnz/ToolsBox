import { spawn, execFile } from 'child_process';
import * as path from 'path';
import { Tool, AppSettings } from '../shared/types';

export function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaping) current += '\\';
  if (current) args.push(current);
  return args;
}

function resolveCwd(tool: Tool): string | undefined {
  if (tool.type === 'app' || tool.type === 'url') return undefined;
  if (tool.workingDirectory?.trim()) return tool.workingDirectory.trim();
  if (tool.path && !tool.path.startsWith('http')) return path.dirname(tool.path);
  return undefined;
}

export function buildCommand(
  tool: Tool,
  settings: AppSettings
): { cmd: string; args: string[]; opts: object } {
  const cwd = resolveCwd(tool);
  const extraArgs = tool.args ? parseArgs(tool.args) : [];

  switch (tool.type) {
    case 'jar': {
      let javaPath = 'java';
      if (tool.javaEnvId) {
        const env = settings.javaEnvs.find(item => item.id === tool.javaEnvId);
        if (env) javaPath = path.join(env.path, 'bin', 'java');
      }
      return {
        cmd: javaPath,
        args: ['-jar', tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    case 'python': {
      let pythonPath = 'python3';
      if (tool.pythonEnvId) {
        const env = settings.pythonEnvs.find(item => item.id === tool.pythonEnvId);
        if (env) pythonPath = path.join(env.path, 'bin', 'python3');
      }
      return {
        cmd: pythonPath,
        args: [tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    case 'shell':
      return {
        cmd: '/bin/bash',
        args: [tool.path, ...extraArgs],
        opts: { cwd },
      };

    case 'app':
      return {
        cmd: 'open',
        args: extraArgs.length > 0 ? [tool.path, '--args', ...extraArgs] : [tool.path],
        opts: {},
      };

    case 'executable':
      return {
        cmd: tool.path,
        args: extraArgs,
        opts: { cwd },
      };

    case 'url': {
      let url = tool.path;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        url = `https://${url}`;
      }
      return {
        cmd: 'open',
        args: [url],
        opts: {},
      };
    }

    default:
      throw new Error(`Unsupported tool type on macOS: ${(tool as { type: string }).type}`);
  }
}

export function launchTool(tool: Tool, settings: AppSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { cmd, args, opts } = buildCommand(tool, settings);
      const proc = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        ...(opts as object),
      });

      proc.on('error', reject);
      proc.unref();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export function openInTerminal(dirPath: string): void {
  const dir = path.isAbsolute(dirPath) ? dirPath : path.dirname(dirPath);
  const escaped = dir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `
set thePath to "${escaped}"
tell application "Terminal" to activate
tell application "Terminal"
  if (count of windows) = 0 then
    do script "cd " & quoted form of thePath
  else
    do script "cd " & quoted form of thePath in front window
  end if
end tell
`.trim();

  const proc = spawn('osascript', ['-'], { stdio: ['pipe', 'ignore', 'ignore'] });
  proc.stdin?.end(script, 'utf8');
}

export function showInFinder(filePath: string): void {
  execFile('open', ['-R', filePath]);
}
