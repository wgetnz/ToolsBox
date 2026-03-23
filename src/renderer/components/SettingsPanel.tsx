import React, { useEffect, useState } from 'react';
import { AppSettings, BackupEntry, JavaEnv, PythonEnv } from '../../shared/types';
import { useApp } from '../store/AppContext';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { data, saveSettings, selectDirectory, showInFinder, createBackup, listBackups, deleteBackup, clearAllData, restoreBackup, importInstalledApps } = useApp();
  const [form, setForm] = useState<AppSettings>(
    data?.settings ?? {
      theme: 'system',
      fontSize: 'medium',
      cardSize: 'medium',
      viewMode: 'grid',
      searchScope: 'all',
      sidebarWidth: 220,
      hoverSwitchCategories: true,
      javaEnvs: [],
      pythonEnvs: [],
      ai: { enabled: true, forceOverwrite: false, provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '', prompt: '' },
      backup: {
        enabled: false,
        directory: '',
        keepCount: 10,
        mode: 'interval',
        intervalHours: 24,
        dailyTime: '03:00',
        weeklyDay: 0,
        weeklyTime: '03:00',
      },
      startAtLogin: false,
      minimizeToTray: true,
    }
  );
  const [activeTab, setActiveTab] = useState<'appearance' | 'ai' | 'backup' | 'java' | 'python' | 'system'>('appearance');
  const [saving, setSaving] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deletingBackupPath, setDeletingBackupPath] = useState('');
  const [importingApps, setImportingApps] = useState(false);
  const [backupEntries, setBackupEntries] = useState<BackupEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!data) return;
    setForm(data.settings);
  }, [data]);

  useEffect(() => {
    if (activeTab !== 'backup') return;

    let cancelled = false;
    setLoadingBackups(true);

    listBackups(form.backup.directory.trim() || undefined)
      .then(entries => {
        if (!cancelled) {
          setBackupEntries(entries);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBackups(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, form.backup.directory, listBackups]);

  const refreshBackups = async (preferredDirectory?: string) => {
    setLoadingBackups(true);
    const entries = await listBackups(preferredDirectory);
    setBackupEntries(entries);
    setLoadingBackups(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    onClose();
  };

  const handleBackupNow = async () => {
    setRunningBackup(true);
    await saveSettings(form);
    const result = await createBackup(form.backup.directory.trim() || undefined);
    setForm(current => ({
      ...current,
      backup: {
        ...current.backup,
        lastBackupAt: result.createdAt,
      },
    }));
    await refreshBackups(form.backup.directory.trim() || undefined);
    setRunningBackup(false);
  };

  const handleSelectBackupDirectory = async () => {
    const dirPath = await selectDirectory();
    if (!dirPath) return;
    update('backup', { ...form.backup, directory: dirPath });
  };

  const handleOpenBackupDirectory = async () => {
    const backupDirectory = form.backup.directory.trim();
    if (!backupDirectory) {
      window.alert('请先设置备份目录，或先保存设置后使用默认备份目录。');
      return;
    }
    await showInFinder(backupDirectory);
  };

  const handleClearAllData = async () => {
    const confirmed = window.confirm('这会先自动备份一份当前数据，然后清空所有工具、分类和设置。确认继续吗？');
    if (!confirmed) return;

    setClearing(true);
    await saveSettings(form);
    await clearAllData();
    setClearing(false);
    onClose();
  };

  const handleRestoreBackup = async (backupPath: string) => {
    const confirmed = window.confirm('恢复备份会先自动备份当前数据，然后用所选备份覆盖当前工具、分类和设置。确认继续吗？');
    if (!confirmed) return;

    setRestoring(true);
    await restoreBackup(backupPath);
    setRestoring(false);
    onClose();
  };

  const handleDeleteBackup = async (backupPath: string) => {
    const confirmed = window.confirm('删除后该备份文件无法恢复，确认继续吗？');
    if (!confirmed) return;

    setDeletingBackupPath(backupPath);
    await deleteBackup(backupPath);
    await refreshBackups(form.backup.directory.trim() || undefined);
    setDeletingBackupPath('');
  };

  const handleImportInstalledApps = async () => {
    setImportingApps(true);
    await saveSettings(form);
    await importInstalledApps();
    setImportingApps(false);
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

  const busy = saving || runningBackup || clearing || restoring || importingApps || Boolean(deletingBackupPath);

  const formatBackupSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const tabs = [
    { id: 'appearance', label: '外观', icon: '🎨' },
    { id: 'ai', label: 'AI', icon: '✨' },
    { id: 'backup', label: '备份', icon: '🗃️' },
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

            {activeTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{
                  padding: '14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>导入已安装 App</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    默认优先用 AI 生成少量大类和更细的副分类，并把更常见、更高频的分类排在前面；关闭下面开关后，会回退到内置规则分类。
                  </div>
                  <div>
                    <button className="btn btn-primary" onClick={handleImportInstalledApps} disabled={busy}>
                      {importingApps ? '导入中...' : '开始导入已安装 App'}
                    </button>
                  </div>
                </div>

                <ToggleItem
                  label="启用 AI 导入分类"
                  description="导入已安装 App 时，调用 AI 自动创建大类优先、重复更少的分类结构"
                  checked={form.ai.enabled}
                  onChange={value => update('ai', { ...form.ai, enabled: value })}
                />

                <ToggleItem
                  label="强制覆盖现有工具和分类"
                  description="导入前先备份当前数据，然后清空现有工具和分类，再按本次规则重新导入"
                  checked={form.ai.forceOverwrite}
                  onChange={value => update('ai', { ...form.ai, forceOverwrite: value })}
                />

                <div className="form-group">
                  <label className="form-label">模型提供方</label>
                  <select
                    className="input"
                    value={form.ai.provider}
                    onChange={event => update('ai', {
                      ...form.ai,
                      provider: event.target.value === 'claude' ? 'claude' : 'openai',
                      baseUrl: event.target.value === 'claude'
                        ? (form.ai.provider === 'claude' ? form.ai.baseUrl : 'https://api.anthropic.com')
                        : (form.ai.provider === 'openai' ? form.ai.baseUrl : 'https://api.openai.com/v1'),
                    })}
                  >
                    <option value="openai">OpenAI 兼容</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Base URL</label>
                  <input
                    className="input"
                    value={form.ai.baseUrl}
                    onChange={event => update('ai', { ...form.ai, baseUrl: event.target.value })}
                    placeholder={form.ai.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input
                    className="input"
                    value={form.ai.apiKey}
                    onChange={event => update('ai', { ...form.ai, apiKey: event.target.value })}
                    placeholder="输入 API Key"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">模型名称</label>
                  <input
                    className="input"
                    value={form.ai.model}
                    onChange={event => update('ai', { ...form.ai, model: event.target.value })}
                    placeholder="例如 gpt-4o-mini / claude-sonnet"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">分类提示词</label>
                  <textarea
                    className="input"
                    value={form.ai.prompt}
                    onChange={event => update('ai', { ...form.ai, prompt: event.target.value })}
                    rows={6}
                    placeholder="例如：总分类少且高频优先，副分类更细，合并重复小类，按用途和场景归类"
                    style={{ resize: 'vertical', minHeight: 120 }}
                  />
                </div>
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

            {activeTab === 'backup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{
                  padding: '14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>立即备份</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    立刻备份当前所有工具、分类和设置。备份文件会保存为 JSON，方便后续手动恢复。
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleBackupNow} disabled={runningBackup || saving}>
                      {runningBackup ? '备份中...' : '立即备份'}
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      上次备份：{form.backup.lastBackupAt ? new Date(form.backup.lastBackupAt).toLocaleString('zh-CN') : '暂无'}
                    </div>
                  </div>
                </div>

                <ToggleItem
                  label="启用自动备份"
                  description="按设定的频率自动备份当前数据"
                  checked={form.backup.enabled}
                  onChange={value => update('backup', { ...form.backup, enabled: value })}
                />

                <div className="form-group">
                  <label className="form-label">备份目录</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      value={form.backup.directory}
                      onChange={event => update('backup', { ...form.backup, directory: event.target.value })}
                      placeholder="留空则使用应用默认备份目录"
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-secondary" onClick={handleSelectBackupDirectory}>选择</button>
                    <button className="btn btn-secondary" onClick={handleOpenBackupDirectory}>打开目录</button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    留空时会使用应用数据目录下的 `backups` 文件夹。
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">保留备份数量</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={200}
                    value={form.backup.keepCount}
                    onChange={event => update('backup', {
                      ...form.backup,
                      keepCount: Math.max(1, Math.min(200, Number(event.target.value) || 1)),
                    })}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    默认保留最近 10 份备份，超出的旧备份会在下次备份后自动清理。
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">自动备份方式</label>
                  <select
                    className="input"
                    value={form.backup.mode}
                    onChange={event => update('backup', {
                      ...form.backup,
                      mode: event.target.value === 'daily' || event.target.value === 'weekly' ? event.target.value : 'interval',
                    })}
                  >
                    <option value="interval">间隔备份</option>
                    <option value="daily">按时间每日备份</option>
                    <option value="weekly">每周备份</option>
                  </select>
                </div>

                {form.backup.mode === 'interval' && (
                  <div className="form-group">
                    <label className="form-label">间隔小时数</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={720}
                      value={form.backup.intervalHours}
                      onChange={event => update('backup', {
                        ...form.backup,
                        intervalHours: Math.max(1, Math.min(720, Number(event.target.value) || 1)),
                      })}
                    />
                  </div>
                )}

                {form.backup.mode === 'daily' && (
                  <div className="form-group">
                    <label className="form-label">每日备份时间</label>
                    <input
                      className="input"
                      type="time"
                      value={form.backup.dailyTime}
                      onChange={event => update('backup', { ...form.backup, dailyTime: event.target.value || '03:00' })}
                    />
                  </div>
                )}

                {form.backup.mode === 'weekly' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">每周备份日</label>
                      <select
                        className="input"
                        value={form.backup.weeklyDay}
                        onChange={event => update('backup', {
                          ...form.backup,
                          weeklyDay: Math.max(0, Math.min(6, Number(event.target.value) || 0)),
                        })}
                      >
                        <option value={0}>周日</option>
                        <option value={1}>周一</option>
                        <option value={2}>周二</option>
                        <option value={3}>周三</option>
                        <option value={4}>周四</option>
                        <option value={5}>周五</option>
                        <option value={6}>周六</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">每周备份时间</label>
                      <input
                        className="input"
                        type="time"
                        value={form.backup.weeklyTime}
                        onChange={event => update('backup', { ...form.backup, weeklyTime: event.target.value || '03:00' })}
                      />
                    </div>
                  </div>
                )}

                <div style={{
                  padding: '14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>备份列表</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        直接从当前备份目录选择一份历史备份恢复。
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => refreshBackups(form.backup.directory.trim() || undefined)} disabled={busy || loadingBackups}>
                      {loadingBackups ? '刷新中...' : '刷新列表'}
                    </button>
                  </div>

                  {loadingBackups ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>正在加载备份列表...</div>
                  ) : backupEntries.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>当前目录下还没有备份文件。</div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}>
                      {backupEntries.map(entry => (
                        <div
                          key={entry.path}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              wordBreak: 'break-all',
                            }}>
                              {entry.fileName}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                              {new Date(entry.createdAt).toLocaleString('zh-CN')} · {formatBackupSize(entry.size)}
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleRestoreBackup(entry.path)}
                            disabled={busy}
                          >
                            {restoring ? '恢复中...' : '恢复'}
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteBackup(entry.path)}
                            disabled={busy}
                          >
                            {deletingBackupPath === entry.path ? '删除中...' : '删除'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 77, 79, 0.08)',
                  border: '1px solid rgba(255, 77, 79, 0.18)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ffb3b5' }}>危险操作</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    清空时会先自动备份当前数据，然后把工具、分类和设置重置为初始状态。
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={handleClearAllData}
                    disabled={busy}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {clearing ? '清空中...' : '清空所有数据'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
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
