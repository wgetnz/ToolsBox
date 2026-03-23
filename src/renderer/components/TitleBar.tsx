import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';

export default function TitleBar() {
  const { data, searchQuery, searchScope, setSearch, setSearchScope, saveSettingsSilent } = useApp();
  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const isMac = navigator.userAgent.includes('Mac');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showSearchInput) return;
    searchInputRef.current?.focus();
  }, [showSearchInput]);

  return (
    <div
      className="titlebar-shell"
      style={{
        padding: isMac ? '0 14px 0 86px' : '0 16px',
        ...dragStyle,
      }}
    >
      <div style={{ flex: 1 }} />

      <div className="titlebar-tools">
        {showSearchInput && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <select
              className="input"
              value={searchScope}
              onChange={event => {
                const nextScope = event.target.value === 'current' ? 'current' : 'all';
                setSearchScope(nextScope);
                if (data) {
                  void saveSettingsSilent({ ...data.settings, searchScope: nextScope });
                }
              }}
              style={{ width: 104, height: 30, padding: '0 10px', fontSize: 12 }}
              title="搜索范围"
            >
              <option value="all">全部分类</option>
              <option value="current">当前分类</option>
            </select>

            <input
              ref={searchInputRef}
              className="input titlebar-search-input"
              placeholder={searchScope === 'all' ? '搜索全部分类...' : '搜索当前分类...'}
              value={searchQuery}
              onChange={event => setSearch(event.target.value)}
              onBlur={() => {
                if (!searchQuery.trim()) {
                  setShowSearchInput(false);
                }
              }}
            />
          </div>
        )}

        <button
          className={`titlebar-search-button${showSearchInput || searchQuery ? ' active' : ''}`}
          onClick={() => {
            setShowSearchInput(current => {
              if (current && !searchQuery.trim()) {
                setSearch('');
                return false;
              }
              return true;
            });
          }}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="搜索"
        >
          ⌕
        </button>
      </div>
    </div>
  );
}
