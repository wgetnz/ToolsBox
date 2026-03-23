import React, { useState, useEffect } from 'react';
import { Tool, ToolType } from '../../shared/types';
import { useApp } from '../store/AppContext';

const TOOL_TYPES: { value: ToolType; label: string; icon: string }[] = [
  { value: 'jar', label: 'JAR 包', icon: '☕' },
  { value: 'python', label: 'Python 脚本', icon: '🐍' },
  { value: 'shell', label: 'Shell 脚本', icon: '💻' },
  { value: 'executable', label: '可执行文件', icon: '⚡' },
  { value: 'app', label: 'macOS App', icon: '📱' },
  { value: 'url', label: 'URL / 网页', icon: '🌐' },
];

// macOS 系统色调色板
const ACCENT_COLORS = [
  '#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#ff375f',
  '#64d2ff', '#ffd60a',
];

interface Props {
  tool?: Tool | null;
  onClose: () => void;
}

function emptyTool(): Partial<Tool> {
  return {
    name: '',
    description: '',
    type: 'executable',
    path: '',
    args: '',
    workingDirectory: '',
    categoryId: 'misc',
    useCount: 0,
    createdAt: Date.now(),
  };
}

function inferType(filePath: string): ToolType {
  if (filePath.endsWith('.app')) return 'app';
  if (filePath.endsWith('.sh') || filePath.endsWith('.bash') || filePath.endsWith('.zsh')) return 'shell';
  if (filePath.endsWith('.jar')) return 'jar';
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return 'url';
  return 'executable';
}

export default function ToolModal({ tool, onClose }: Props) {
  const { data, saveTool, selectFile, selectDirectory } = useApp();
  const [form, setForm] = useState<Partial<Tool>>(tool ? { ...tool } : emptyTool());
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setForm(tool ? { ...tool } : emptyTool());
  }, [tool]);

  if (!data) return null;

  const { categories, settings } = data;
  // 只显示叶子分类（子分类或无子分类的顶级分类），用于关联工具
  const leafCategories = categories.filter(c => c.id !== 'all');

  const update = (field: keyof Tool, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleBrowse = async () => {
    let filters: { name: string; extensions: string[] }[] | undefined;
    switch (form.type) {
      case 'jar': filters = [{ name: 'JAR Files', extensions: ['jar'] }]; break;
      case 'python': filters = [{ name: 'Python Files', extensions: ['py'] }]; break;
      case 'shell': filters = [{ name: 'Shell Scripts', extensions: ['sh', 'bash', 'zsh'] }]; break;
      case 'app': filters = [{ name: 'Applications', extensions: ['app'] }]; break;
      default: filters = undefined;
    }
    const p = await selectFile(filters);
    if (p) {
      update('path', p);
      if (!form.name) {
        const parts = p.split('/');
        const filename = parts[parts.length - 1];
        update('name', filename.replace(/\.[^.]+$/, ''));
      }
    }
  };

  const handleBrowseDir = async () => {
    const dir = await selectDirectory();
    if (dir) update('workingDirectory', dir);
  };

  // 拖入 .app 或其他文件时自动填充
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const filePath = (e.dataTransfer.files[0] as any)?.path;
    if (!filePath) return;

    const parts = filePath.split('/');
    const filename = parts[parts.length - 1];
    const name = filename.replace(/\.app$/, '').replace(/\.[^.]+$/, '');
    const type = inferType(filePath);

    let icon: string | undefined;
    try {
      const result = await window.launchbox.getFileIcon(filePath);
      icon = result ?? undefined;
    } catch { /* 忽略提取失败 */ }

    setForm(f => ({ ...f, name, path: filePath, type, icon }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    if (!form.path?.trim()) return;
    setSaving(true);
    await saveTool(form as Tool);
    setSaving(false);
    onClose();
  };

  const isEditing = !!tool?.id;
  const showWorkingDir = form.type !== 'url' && form.type !== 'app';

  return (
    <div
      className="overlay"
      onClick={onClose}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <div
        className="modal"
        style={{
          width: 560,
          outline: dragOver ? '2px dashed var(--accent-color)' : 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">{isEditing ? '编辑工具' : '添加工具'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {dragOver && (
            <div style={{
              textAlign: 'center',
              color: 'var(--accent-color)',
              fontSize: 13,
              padding: '8px 0',
            }}>
              拖入 .app 或其他文件自动填充
            </div>
          )}

          {/* 工具类型 */}
          <div className="form-group">
            <label className="form-label">工具类型</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TOOL_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => update('type', t.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${form.type === t.value ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: form.type === t.value ? 'var(--accent-color)' : 'var(--bg-input)',
                    color: form.type === t.value ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.1s',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 名称 + 颜色标签 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">工具名称 *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="输入工具名称"
              />
            </div>
            <div className="form-group">
              <label className="form-label">颜色标签</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* 无色 */}
                <div
                  onClick={() => update('accentColor', undefined)}
                  title="无颜色"
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: '1.5px solid var(--border-color)',
                    cursor: 'pointer',
                    outline: !form.accentColor ? '2px solid var(--accent-color)' : 'none',
                    outlineOffset: 2,
                  }}
                />
                {ACCENT_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => update('accentColor', c)}
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: c, cursor: 'pointer',
                      outline: form.accentColor === c ? '2px solid var(--accent-color)' : 'none',
                      outlineOffset: 2,
                      transition: 'transform 0.1s',
                      transform: form.accentColor === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 描述 */}
          <div className="form-group">
            <label className="form-label">描述</label>
            <input
              className="input"
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="简短描述（可选）"
            />
          </div>

          {/* 路径 */}
          <div className="form-group">
            <label className="form-label">
              {form.type === 'url' ? 'URL 地址 *' : '文件路径 *'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={form.path}
                onChange={e => update('path', e.target.value)}
                placeholder={form.type === 'url' ? 'https://...' : '/path/to/tool'}
                style={{ flex: 1 }}
              />
              {form.type !== 'url' && (
                <button className="btn btn-secondary" onClick={handleBrowse}>浏览</button>
              )}
            </div>
          </div>

          {/* 工作目录（app/url 类型隐藏）*/}
          {showWorkingDir && (
            <div className="form-group">
              <label className="form-label">工作目录</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={form.workingDirectory ?? ''}
                  onChange={e => update('workingDirectory', e.target.value || undefined)}
                  placeholder="留空则使用文件所在目录"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={handleBrowseDir}>选择</button>
              </div>
            </div>
          )}

          {/* 启动参数 */}
          <div className="form-group">
            <label className="form-label">启动参数</label>
            <input
              className="input"
              value={form.args}
              onChange={e => update('args', e.target.value)}
              placeholder="例: -Xmx2g / --port 8080"
            />
          </div>

          {/* 分类 + 环境选择 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">分类</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={e => update('categoryId', e.target.value)}
              >
                {leafCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {form.type === 'jar' && settings.javaEnvs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Java 环境</label>
                <select
                  className="input"
                  value={form.javaEnvId ?? ''}
                  onChange={e => update('javaEnvId', e.target.value || undefined)}
                >
                  <option value="">系统默认</option>
                  {settings.javaEnvs.map(j => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </div>
            )}

            {form.type === 'python' && settings.pythonEnvs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Python 环境</label>
                <select
                  className="input"
                  value={form.pythonEnvId ?? ''}
                  onChange={e => update('pythonEnvId', e.target.value || undefined)}
                >
                  <option value="">系统默认</option>
                  {settings.pythonEnvs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !form.name?.trim() || !form.path?.trim()}
          >
            {saving ? '保存中...' : isEditing ? '保存修改' : '添加工具'}
          </button>
        </div>
      </div>
    </div>
  );
}
