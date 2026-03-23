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
  const { data, saveCategory, deleteCategory } = useApp();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? '📦');
  const [parentId, setParentId] = useState<string>(category?.parentId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '📦');
    setParentId(category?.parentId ?? '');
  }, [category]);

  const topCategories = (data?.categories ?? []).filter(
    item => !item.parentId && item.id !== 'all' && item.id !== category?.id
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await saveCategory({
      id: category?.id ?? '',
      name: name.trim(),
      icon,
      order: category?.order ?? 99,
      parentId: parentId || undefined,
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
      <div className="modal" style={{ width: 400 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{category?.id ? '编辑分类' : '添加分类'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">图标</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
              {ICONS.map(item => (
                <button
                  key={item}
                  onClick={() => setIcon(item)}
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: 20,
                    borderRadius: 8,
                    border: `2px solid ${icon === item ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: icon === item ? 'var(--accent-color)20' : 'var(--bg-input)',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">分类名称</label>
            <input
              className="input"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="输入分类名称"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">父分类（可选）</label>
            <select
              className="input"
              value={parentId}
              onChange={event => setParentId(event.target.value)}
            >
              <option value="">— 顶级分类 —</option>
              {topCategories.map(item => (
                <option key={item.id} value={item.id}>{item.icon} {item.name}</option>
              ))}
            </select>
          </div>

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
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
