import React, { useState } from 'react';
import { AppSettings, JavaEnv, PythonEnv } from '../../shared/types';
import { useApp } from '../store/AppContext';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { data, saveSettings, selectDirectory } = useApp();
  const [form, setForm] = useState<AppSettings>(
    data?.settings ?? {
      theme: 'system',
      fontSize: 'medium',
      cardSize: 'medium',
      viewMode: 'grid',
      sidebarWidth: 220,
      hoverSwitchCategories: true,
      javaEnvs: [],
      pythonEnvs: [],
      startAtLogin: false,
      minimizeToTray: true,
    }
  );
  const [activeTab, setActiveTab] = useState<'appearance' | 'java' | 'python' | 'system'>('appearance');
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    onClose();
  };

  const addJavaEnv = async () => {
    const dirPath = await selectDirectory();
    if (!dirPath) return;
    const name = dirPath.split('/').pop() ?? 'Java';
    update('javaEnvs', [...form.javaEnvs, { id: Date.now().toString(), name, path: dirPath }]);
  };

  const addPythonEnv = async () => {
    const dirPath = await selectDirectory();
    if (!dirPath) return;
    const name = dirPath.split('/').pop() ?? 'Python';
    update('pythonEnvs', [...form.pythonEnvs, { id: Date.now().toString(), name, path: dirPath }]);
  };

  const tabs = [
    { id: 'appearance', label: '外观', icon: '🎨' },
    { id: 'java', label: 'Java 环境', icon: '☕' },
    { id: 'python', label: 'Python 环境', icon: '🐍' },
    { id: 'system', label: '系统', icon: '⚙️' },
  ] as const;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 600, height: 500 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">⚙️ 设置</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{
            width: 140,
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === tab.id ? 'var(--accent-color)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  textAlign: 'left',
                  transition: 'all 0.1s',
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label">主题</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {([
                      ['system', '🖥 跟随系统', '#555'],
                      ['dark', '🌙 深色', '#1c1c1e'],
                      ['light', '☀️ 浅色', '#f2f2f7'],
                    ] as const).map(([theme, label, background]) => (
                      <button
                        key={theme}
                        onClick={() => update('theme', theme)}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 10,
                          border: `2px solid ${form.theme === theme ? 'var(--accent-color)' : 'var(--border-color)'}`,
                          background: theme === 'system' ? 'var(--bg-tertiary)' : background,
                          color: theme === 'dark' ? '#fff' : theme === 'system' ? 'var(--text-primary)' : '#1c1c1e',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: form.theme === theme ? 600 : 400,
                          fontFamily: 'inherit',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">默认视图</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => update('viewMode', 'grid')}
                      className={`btn ${form.viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                    >
                      ⊞ 网格
                    </button>
                    <button
                      onClick={() => update('viewMode', 'list')}
                      className={`btn ${form.viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                    >
                      ☰ 列表
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">字体大小</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => update('fontSize', size)}
                        className={`btn ${form.fontSize === size ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                      >
                        {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">卡片大小</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => update('cardSize', size)}
                        className={`btn ${form.cardSize === size ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                      >
                        {size === 'small' ? '紧凑' : size === 'medium' ? '标准' : '宽松'}
                      </button>
                    ))}
                  </div>
                </div>

                <ToggleItem
                  label="悬停切换分类"
                  description="鼠标移到侧边栏分类时自动切换当前分栏"
                  checked={form.hoverSwitchCategories}
                  onChange={value => update('hoverSwitchCategories', value)}
                />
              </div>
            )}

            {activeTab === 'java' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  配置多版本 Java 环境，在工具中按需选择。
                </div>
                {form.javaEnvs.map(env => (
                  <EnvItem
                    key={env.id}
                    env={env}
                    onNameChange={name => update('javaEnvs', form.javaEnvs.map(item => item.id === env.id ? { ...item, name } : item))}
                    onRemove={() => update('javaEnvs', form.javaEnvs.filter(item => item.id !== env.id))}
                  />
                ))}
                <button className="btn btn-secondary" onClick={addJavaEnv} style={{ alignSelf: 'flex-start' }}>
                  ☕ 添加 Java 环境
                </button>
              </div>
            )}

            {activeTab === 'python' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  配置多版本 Python 环境，在工具中按需选择。
                </div>
                {form.pythonEnvs.map(env => (
                  <EnvItem
                    key={env.id}
                    env={env}
                    onNameChange={name => update('pythonEnvs', form.pythonEnvs.map(item => item.id === env.id ? { ...item, name } : item))}
                    onRemove={() => update('pythonEnvs', form.pythonEnvs.filter(item => item.id !== env.id))}
                  />
                ))}
                <button className="btn btn-secondary" onClick={addPythonEnv} style={{ alignSelf: 'flex-start' }}>
                  🐍 添加 Python 环境
                </button>
              </div>
            )}

            {activeTab === 'system' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ToggleItem
                  label="开机自启动"
                  description="登录时自动启动 LaunchBox"
                  checked={form.startAtLogin}
                  onChange={value => update('startAtLogin', value)}
                />
                <ToggleItem
                  label="最小化到托盘"
                  description="关闭窗口时最小化到系统托盘而非退出"
                  checked={form.minimizeToTray}
                  onChange={value => update('minimizeToTray', value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EnvItem({
  env,
  onNameChange,
  onRemove,
}: {
  env: JavaEnv | PythonEnv;
  onNameChange: (name: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={env.name}
          onChange={event => onNameChange(event.target.value)}
          placeholder="环境名称"
          style={{ flex: 1 }}
        />
        <button className="btn btn-danger btn-icon" onClick={onRemove} title="删除">🗑️</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {env.path}
      </div>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px',
      background: 'var(--bg-tertiary)',
      borderRadius: 10,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? 'var(--accent-color)' : 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
    </div>
  );
}
