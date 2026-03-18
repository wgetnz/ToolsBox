import React, { useState, useEffect } from 'react';
import { Category } from '../../shared/types';
import { useApp } from '../store/AppContext';

const ICONS = [
  '🔧', '🔍', '💥', '🌐', '🕸️', '📦', '🛡️', '🔑', '📡', '💻',
  '🐛', '⚡', '🎯', '🔐', '📊', '🗂️', '🧰', '🔬', '🧩', '🚀',
  '📱', '🖥️', '🌍', '🔒', '💡', '⚙️', '🧪', '📝', '🎮', '🤖',
];

interface Props {
  category?: Category | null;
  onClose: () => void;
}

export default function CategoryModal({ category, onClose }: Props) {
  const { saveCategory, deleteCategory } = useApp();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '📦');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '📦');
  }, [category]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await saveCategory({
      id: category?.id ?? '',
      name: name.trim(),
      icon,
      order: category?.order ?? 99,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!category?.id) return;
    if (!confirm(`确认删除分类 "${category.name}"？该分类下的工具将移至"其他工具"。`)) return;
    await deleteCategory(category.id);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{category?.id ? '编辑分类' : '添加分类'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">图标</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              maxHeight: 140,
              overflowY: 'auto',
            }}>
              {ICONS.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: 20,
                    borderRadius: 8,
                    border: `2px solid ${icon === ic ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: icon === ic ? 'var(--accent-color)20' : 'var(--bg-input)',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">分类名称</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入分类名称"
              autoFocus
            />
          </div>

          {/* Preview */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--bg-tertiary)',
            borderRadius: 10,
            fontSize: 14,
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{name || '分类名称'}</span>
          </div>
        </div>

        <div className="modal-footer">
          {category?.id && (
            <button className="btn btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
              删除
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
