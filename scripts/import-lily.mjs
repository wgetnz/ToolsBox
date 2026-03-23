#!/usr/bin/env node
/**
 * Lily → ToolsBox 数据迁移脚本
 *
 * 用法：
 *   node scripts/import-lily.mjs [data.json路径]
 *
 * 默认读取当前目录下的 data.json。
 * 输出 toolsbox-data.json，复制到：
 *   ~/Library/Application Support/launchbox/launchbox-data.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const inputPath = process.argv[2] ?? 'data.json';

let lilyData;
try {
  lilyData = JSON.parse(readFileSync(inputPath, 'utf-8'));
} catch (e) {
  console.error(`无法读取 ${inputPath}:`, e.message);
  process.exit(1);
}

const tools = [];
const categories = [];
let order = 0;

for (const mainType of (lilyData.mainType ?? [])) {
  // 顶级分类
  const groupId = randomUUID();
  categories.push({
    id: groupId,
    name: mainType.Name,
    icon: '📁',
    order: order++ * 100,
    parentId: undefined,
  });

  for (const tab of (mainType.TabData ?? [])) {
    // 子分类
    const tabId = randomUUID();
    categories.push({
      id: tabId,
      name: tab.Name,
      icon: '📂',
      order: order++,
      parentId: groupId,
    });

    for (const item of (tab.ItemData ?? [])) {
      // 跳过 Windows 专有类型
      if (['Built', 'Control', 'lnkFile'].includes(item.ItemType)) continue;

      const ext = extname(item.TargetPath ?? '').toLowerCase();

      // 跳过 Windows 可执行文件
      if (['.exe', '.bat', '.cmd', '.msi', '.msc'].includes(ext)) continue;

      let type;
      if (ext === '.app' || item.ItemType === 'exeFile') {
        type = 'app';
      } else if (ext === '.jar') {
        type = 'jar';
      } else if (ext === '.py') {
        type = 'python';
      } else if (['.sh', '.bash', '.zsh'].includes(ext)) {
        type = 'shell';
      } else if (ext === '.html' || ext === '.htm') {
        // 本地 HTML 文件 → file:// URL
        type = 'url';
        item.TargetPath = `file://${item.TargetPath}`;
      } else if ((item.TargetPath ?? '').startsWith('http')) {
        type = 'url';
      } else if (item.ItemType === 'otherFile') {
        type = 'executable';
      } else {
        console.warn(`跳过无法识别的工具: ${item.Name} (${item.TargetPath})`);
        continue;
      }

      // Lily colorR/G/B → accentColor hex（若有颜色且不是默认黑色）
      let accentColor;
      if (item.ColorR !== undefined && item.ColorG !== undefined && item.ColorB !== undefined) {
        const r = item.ColorR, g = item.ColorG, b = item.ColorB;
        if (r !== 0 || g !== 0 || b !== 0) {
          accentColor = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
        }
      }

      tools.push({
        id: randomUUID(),
        name: item.Name,
        description: item.Remarks ?? '',
        type,
        path: item.TargetPath ?? '',
        args: item.Parameter ?? '',
        workingDirectory: item.WorkingDirectory || undefined,
        categoryId: tabId,
        accentColor,
        icon: undefined,
        useCount: item.RunCount ?? 0,
        lastUsed: undefined,
        createdAt: Date.now(),
      });
    }
  }
}

const output = {
  tools,
  categories: [
    { id: 'all', name: '全部工具', icon: '🔧', order: -1 },
    ...categories,
  ],
  settings: {
    theme: 'system',
    fontSize: 'medium',
    cardSize: 'medium',
    viewMode: 'grid',
    sidebarWidth: 220,
    javaEnvs: [],
    pythonEnvs: [],
    startAtLogin: false,
    minimizeToTray: true,
  },
};

writeFileSync('toolsbox-data.json', JSON.stringify(output, null, 2));
console.log(`✅ 导出完成：${tools.length} 个工具，${categories.length} 个分类`);
console.log(`📁 输出文件：toolsbox-data.json`);
console.log(`💡 复制到：~/Library/Application Support/launchbox/launchbox-data.json`);
