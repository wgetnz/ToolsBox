import { spawn, exec } from 'child_process';
import * as path from 'path';
import { Tool, AppSettings } from '../shared/types';

function getPlatform(): 'mac' | 'win' | 'linux' {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  return 'linux';
}

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

export function buildCommand(tool: Tool, settings: AppSettings): { cmd: string; args: string[]; opts: object } {
  const platform = getPlatform();
  const extraArgs = tool.args ? parseArgs(tool.args) : [];

  switch (tool.type) {
    case 'jar': {
      let javaPath = 'java';
      if (tool.javaEnvId) {
        const jenv = settings.javaEnvs.find(j => j.id === tool.javaEnvId);
        if (jenv) {
          javaPath = platform === 'win'
            ? path.join(jenv.path, 'bin', 'java.exe')
            : path.join(jenv.path, 'bin', 'java');
        }
      }
      return {
        cmd: javaPath,
        args: ['-jar', tool.path, ...extraArgs],
        opts: { cwd: path.dirname(tool.path) },
      };
    }

    case 'python': {
      let pythonPath = 'python3';
      if (tool.pythonEnvId) {
        const penv = settings.pythonEnvs.find(p => p.id === tool.pythonEnvId);
        if (penv) {
          pythonPath = platform === 'win'
            ? path.join(penv.path, 'python.exe')
            : path.join(penv.path, 'bin', 'python3');
        }
      }
      return {
        cmd: pythonPath,
        args: [tool.path, ...extraArgs],
        opts: { cwd: path.dirname(tool.path) },
      };
    }

    case 'shell': {
      if (platform === 'win') {
        return { cmd: 'cmd.exe', args: ['/c', tool.path, ...extraArgs], opts: {} };
      }
      return {
        cmd: '/bin/bash',
        args: [tool.path, ...extraArgs],
        opts: { cwd: path.dirname(tool.path) },
      };
    }

    case 'executable': {
      return {
        cmd: tool.path,
        args: extraArgs,
        opts: { cwd: path.dirname(tool.path) },
      };
    }

    case 'app': {
      if (platform === 'mac') {
        return {
          cmd: 'open',
          args: extraArgs.length > 0 ? ['-a', tool.path, '--args', ...extraArgs] : ['-a', tool.path],
          opts: {},
        };
      }
      return { cmd: tool.path, args: extraArgs, opts: {} };
    }

    case 'batch': {
      if (platform === 'win') {
        return { cmd: 'cmd.exe', args: ['/c', tool.path, ...extraArgs], opts: {} };
      }
      return { cmd: '/bin/bash', args: [tool.path, ...extraArgs], opts: {} };
    }

    case 'url': {
      if (platform === 'mac') return { cmd: 'open', args: [tool.path], opts: {} };
      if (platform === 'win') return { cmd: 'start', args: ['', tool.path], opts: { shell: true } };
      return { cmd: 'xdg-open', args: [tool.path], opts: {} };
    }

    default:
      throw new Error(`Unknown tool type: ${tool.type}`);
  }
}

export function launchTool(tool: Tool, settings: AppSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { cmd, args, opts } = buildCommand(tool, settings);
      console.log(`Launching: ${cmd} ${args.join(' ')}`);

      const proc = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        ...(opts as object),
      });

      proc.unref();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function openInTerminal(dirPath: string): void {
  const platform = getPlatform();
  const dir = path.isAbsolute(dirPath) ? dirPath : path.dirname(dirPath);

  if (platform === 'mac') {
    exec(`open -a Terminal "${dir}"`);
  } else if (platform === 'win') {
    exec(`start cmd.exe /k "cd /d "${dir}""`);
  } else {
    const terminals = ['gnome-terminal', 'xterm', 'konsole', 'xfce4-terminal'];
    const term = terminals[0];
    exec(`${term} --working-directory="${dir}"`);
  }
}

export function showInFinder(filePath: string): void {
  const platform = getPlatform();
  if (platform === 'mac') {
    exec(`open -R "${filePath}"`);
  } else if (platform === 'win') {
    exec(`explorer /select,"${filePath}"`);
  } else {
    exec(`xdg-open "${path.dirname(filePath)}"`);
  }
}
