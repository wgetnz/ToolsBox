// macOS 专用启动器
import { spawn, execFile } from 'child_process';
import * as path from 'path';
import { Tool, AppSettings } from '../shared/types';

function buildCommand(
  tool: Tool,
  settings: AppSettings
): { cmd: string; args: string[]; opts: object } {
  // workingDirectory 优先，其次取文件所在目录（app/url 类型不传 cwd）
  const cwd = tool.workingDirectory
    || (tool.path && !tool.path.startsWith('http') ? path.dirname(tool.path) : undefined);

  const extraArgs = tool.args
    ? tool.args.split(/\s+/).filter(Boolean)
    : [];

  switch (tool.type) {

    // java -jar /path/to/tool.jar [args]
    case 'jar': {
      let javaPath = 'java';
      if (tool.javaEnvId) {
        const jenv = settings.javaEnvs.find(j => j.id === tool.javaEnvId);
        if (jenv) javaPath = path.join(jenv.path, 'bin', 'java');
      }
      return {
        cmd: javaPath,
        args: ['-jar', tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    // python3 /path/to/script.py [args]
    case 'python': {
      let pythonPath = 'python3';
      if (tool.pythonEnvId) {
        const penv = settings.pythonEnvs.find(p => p.id === tool.pythonEnvId);
        if (penv) pythonPath = path.join(penv.path, 'bin', 'python3');
      }
      return {
        cmd: pythonPath,
        args: [tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    // /bin/bash /path/to/script.sh [args]
    case 'shell': {
      return {
        cmd: '/bin/bash',
        args: [tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    // open /path/to/App.app [--args arg1 arg2]
    // 使用系统 open 命令，Gatekeeper 兼容；cwd 对 open 无意义
    case 'app': {
      const openArgs = extraArgs.length > 0
        ? [tool.path, '--args', ...extraArgs]
        : [tool.path];
      return { cmd: 'open', args: openArgs, opts: {} };
    }

    // 直接执行 Unix binary
    case 'executable': {
      return {
        cmd: tool.path,
        args: extraArgs,
        opts: { cwd },
      };
    }

    // open "https://..." 或 "file:///path/to/file.html"
    // 无协议头时自动补 https://
    case 'url': {
      let url = tool.path;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        url = 'https://' + url;
      }
      return { cmd: 'open', args: [url], opts: {} };
    }

    default:
      throw new Error(`Unsupported tool type on macOS: ${(tool as any).type}`);
  }
}

export function launchTool(tool: Tool, settings: AppSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { cmd, args, opts } = buildCommand(tool, settings);
      console.log(`[Launch] ${cmd} ${args.join(' ')}`);

      const proc = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        ...(opts as object),
      });

      proc.on('error', reject);
      proc.unref();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// 用 AppleScript 在 Terminal.app 中打开指定目录
// 通过 stdin 传脚本（而非 -e 拼接），路径以 AppleScript 字符串传递避免注入
export function openInTerminal(dirPath: string): void {
  const dir = path.isAbsolute(dirPath) ? dirPath : path.dirname(dirPath);
  // AppleScript 字符串转义：\ → \\，" → \"
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

// 在 Finder 中选中文件（等价于 Windows explorer /select）
export function showInFinder(filePath: string): void {
  execFile('open', ['-R', filePath]);
}
