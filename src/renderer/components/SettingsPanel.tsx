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
      theme: 'dark',
      fontSize: 'medium',
      cardSize: 'medium',
      javaEnvs: [],
      pythonEnvs: [],
      startAtLogin: false,
      minimizeToTray: true,
    }
  );
  const [activeTab, setActiveTab] = useState<'appearance' | 'java' | 'python' | 'system'>('appearance');
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    onClose();
  };

  const addJavaEnv = async () => {
    const path = await selectDirectory();
    if (!path) return;
    const name = path.split('/').pop() ?? 'Java';
    const id = Date.now().toString();
    update('javaEnvs', [...form.javaEnvs, { id, name, path }]);
  };

  const removeJavaEnv = (id: string) =>
    update('javaEnvs', form.javaEnvs.filter(j => j.id !== id));

  const updateJavaName = (id: string, name: string) =>
    update('javaEnvs', form.javaEnvs.map(j => j.id === id ? { ...j, name } : j));

  const addPythonEnv = async () => {
    const path = await selectDirectory();
    if (!path) return;
    const name = path.split('/').pop() ?? 'Python';
    const id = Date.now().toString();
    update('pythonEnvs', [...form.pythonEnvs, { id, name, path }]);
  };

  const removePythonEnv = (id: string) =>
    update('pythonEnvs', form.pythonEnvs.filter(p => p.id !== id));

  const updatePythonName = (id: string, name: string) =>
    update('pythonEnvs', form.pythonEnvs.map(p => p.id === id ? { ...p, name } : p));

  const tabs = [
    { id: 'appearance', label: '外观', icon: '🎨' },
    { id: 'java', label: 'Java 环境', icon: '☕' },
    { id: 'python', label: 'Python 环境', icon: '🐍' },
    { id: 'system', label: '系统', icon: '⚙️' },
  ] as const;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 600, height: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">⚙️ 设置</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Tabs */}
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

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label">主题</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['dark', 'light'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => update('theme', t)}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 10,
                          border: `2px solid ${form.theme === t ? 'var(--accent-color)' : 'var(--border-color)'}`,
                          background: t === 'dark' ? '#1a1a2e' : '#f5f6fa',
                          color: t === 'dark' ? '#e8eaf6' : '#1a1a2e',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: form.theme === t ? 600 : 400,
                        }}
                      >
                        {t === 'dark' ? '🌙 暗色主题' : '☀️ 亮色主题'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">字体大小</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['small', 'medium', 'large'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => update('fontSize', s)}
                        className={`btn ${form.fontSize === s ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                      >
                        {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">卡片大小</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['small', 'medium', 'large'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => update('cardSize', s)}
                        className={`btn ${form.cardSize === s ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                      >
                        {s === 'small' ? '紧凑' : s === 'medium' ? '标准' : '宽松'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">自定义背景色</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.backgroundColor ?? '#1a1a2e'}
                      onChange={e => update('backgroundColor', e.target.value)}
                      style={{
                        width: 44,
                        height: 36,
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: 'none',
                        padding: 2,
                      }}
                    />
                    <input
                      className="input"
                      value={form.backgroundColor ?? ''}
                      onChange={e => update('backgroundColor', e.target.value)}
                      placeholder="留空使用主题默认色"
                      style={{ flex: 1 }}
                    />
                    {form.backgroundColor && (
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => update('backgroundColor', undefined)}
                        title="重置"
                      >✕</button>
                    )}
                  </div>
                </div>
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
                    onNameChange={name => updateJavaName(env.id, name)}
                    onRemove={() => removeJavaEnv(env.id)}
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
                    onNameChange={name => updatePythonName(env.id, name)}
                    onRemove={() => removePythonEnv(env.id)}
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
                  onChange={v => update('startAtLogin', v)}
                />
                <ToggleItem
                  label="最小化到托盘"
                  description="关闭窗口时最小化到系统托盘而非退出"
                  checked={form.minimizeToTray}
                  onChange={v => update('minimizeToTray', v)}
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
          onChange={e => onNameChange(e.target.value)}
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
