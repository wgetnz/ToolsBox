import React, { useState, useEffect } from 'react';
import { Tool, ToolType } from '../../shared/types';
import { useApp } from '../store/AppContext';

const TOOL_TYPES: { value: ToolType; label: string; icon: string }[] = [
  { value: 'jar', label: 'JAR 包', icon: '☕' },
  { value: 'python', label: 'Python 脚本', icon: '🐍' },
  { value: 'shell', label: 'Shell 脚本', icon: '💻' },
  { value: 'executable', label: '可执行文件', icon: '⚡' },
  { value: 'app', label: 'macOS App', icon: '📱' },
  { value: 'batch', label: 'Windows 批处理', icon: '📜' },
  { value: 'url', label: 'URL / 网页', icon: '🌐' },
];

const CARD_COLORS = [
  '#4f8ef7', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#3498db', '#e67e22', '#e91e63', '#00bcd4',
  '#ff5722', '#607d8b', '#795548', '#ffeb3b', '#8bc34a',
];

interface Props {
  tool?: Tool | null;
  initialValues?: Partial<Tool>;
  onClose: () => void;
}

function emptyTool(initialValues?: Partial<Tool>): Partial<Tool> {
  return {
    name: '',
    description: '',
    type: 'executable',
    path: '',
    args: '',
    categoryId: 'misc',
    color: '#4f8ef7',
    useCount: 0,
    createdAt: Date.now(),
    ...initialValues,
  };
}

export default function ToolModal({ tool, initialValues, onClose }: Props) {
  const { data, saveTool, selectFile } = useApp();
  const [form, setForm] = useState<Partial<Tool>>(tool ? { ...tool } : emptyTool(initialValues));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(tool ? { ...tool } : emptyTool(initialValues));
  }, [tool, initialValues]);

  if (!data) return null;

  const { categories, settings } = data;
  const nonAllCategories = categories.filter(c => c.id !== 'all');

  const update = (field: keyof Tool, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleBrowse = async () => {
    let filters: { name: string; extensions: string[] }[] | undefined;

    switch (form.type) {
      case 'jar':
        filters = [{ name: 'JAR Files', extensions: ['jar'] }];
        break;
      case 'python':
        filters = [{ name: 'Python Files', extensions: ['py'] }];
        break;
      case 'shell':
        filters = [{ name: 'Shell Scripts', extensions: ['sh', 'bash', 'zsh'] }];
        break;
      case 'app':
        filters = [{ name: 'Applications', extensions: ['app'] }];
        break;
      case 'batch':
        filters = [{ name: 'Batch Files', extensions: ['bat', 'cmd'] }];
        break;
      default:
        filters = undefined;
    }

    const path = await selectFile(filters);
    if (path) {
      update('path', path);
      // Auto-fill name from filename if empty
      if (!form.name) {
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        const name = filename.replace(/\.[^.]+$/, '');
        update('name', name);
      }
    }
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

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEditing ? '编辑工具' : '添加工具'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Tool type selector */}
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
                  }}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Color */}
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
              <label className="form-label">颜色</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 180 }}>
                {CARD_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => update('color', c)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      background: c,
                      cursor: 'pointer',
                      outline: form.color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: 2,
                      transition: 'transform 0.1s',
                      transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">描述</label>
            <input
              className="input"
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="简短描述（可选）"
            />
          </div>

          {/* Path */}
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
                <button className="btn btn-secondary" onClick={handleBrowse}>
                  浏览
                </button>
              )}
            </div>
          </div>

          {/* Args */}
          <div className="form-group">
            <label className="form-label">启动参数</label>
            <input
              className="input"
              value={form.args}
              onChange={e => update('args', e.target.value)}
              placeholder="例: -Xmx2g -jar / --port 8080"
            />
          </div>

          {/* Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">分类</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={e => update('categoryId', e.target.value)}
              >
                {nonAllCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Java env selector */}
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

            {/* Python env selector */}
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
