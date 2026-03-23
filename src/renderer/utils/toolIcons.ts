import { Tool, ToolType } from '../../shared/types';

const TYPE_DEFAULT_ICONS: Record<ToolType, string> = {
  jar: '☕',
  python: '🐍',
  shell: '💻',
  executable: '⚙️',
  app: '🧩',
  url: '🌐',
};

const KEYWORD_ICON_RULES: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /(chrome|safari|firefox|edge|arc|browser)/i, icon: '🌐' },
  { pattern: /(terminal|iterm|warp|shell|bash|zsh|fish|ssh)/i, icon: '💻' },
  { pattern: /(code|cursor|studio|idea|xcode|dev|android|adb|scrcpy)/i, icon: '💻' },
  { pattern: /(chatgpt|claude|deepseek|kimi|ollama|ai)/i, icon: '✨' },
  { pattern: /(wechat|weixin|telegram|discord|qq|slack)/i, icon: '💬' },
  { pattern: /(music|video|player|spotify|netease|qqmusic)/i, icon: '🎵' },
  { pattern: /(burp|wireshark|charles|mitm|proxy|packet|fiddler)/i, icon: '📡' },
  { pattern: /(ida|ghidra|hopper|jadx|apktool|reverse)/i, icon: '🛠️' },
];

export function getToolFallbackIcon(input: Pick<Partial<Tool>, 'type' | 'path' | 'name'>): string {
  const type = input.type ?? 'executable';
  const source = `${input.name ?? ''} ${input.path ?? ''}`.trim();

  for (const rule of KEYWORD_ICON_RULES) {
    if (rule.pattern.test(source)) {
      return rule.icon;
    }
  }

  return TYPE_DEFAULT_ICONS[type];
}
