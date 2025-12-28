import React, { useEffect, useRef, useState } from 'react';
import { buildWallpaperUrl, DEFAULT_WALLPAPER } from '../../../services/wallpaperService';

export default function WallpaperPanel({
  open,
  onClose,
  presets = [],
  value = DEFAULT_WALLPAPER,
  onChange,
  onSave,
  onReset,
  onUpload,
  saving
}) {
  const [draft, setDraft] = useState(value);
  const [customUrl, setCustomUrl] = useState(value.imageUrl || '');
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);

  // ESC key handler
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Click outside handler
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  useEffect(() => {
    setDraft(value);
    setCustomUrl(value.imageUrl || '');
  }, [value]);

  if (!open) return null;

  const applyChange = (updates) => {
    const next = { ...draft, ...updates };
    setDraft(next);
    if (onChange) onChange(next);
  };

  const selectPreset = (preset) => {
    applyChange({
      sourceType: 'preset',
      presetKey: preset.key,
      imageUrl: preset.value || ''
    });
  };

  const handleCustomUrlApply = () => {
    if (!customUrl.trim()) return;
    applyChange({ sourceType: 'custom', imageUrl: customUrl.trim() });
  };

  const getPreviewBackground = () => {
    // For preset: use gradient directly
    if (draft.sourceType === 'preset') {
      const preset = presets.find((p) => p.key === draft.presetKey);
      return preset?.value || '';
    }
    // For custom: show placeholder message
    return 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 2000 }} role="dialog" aria-modal="true" aria-labelledby="wallpaper-panel-title">
      <div ref={panelRef} style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '16px', width: 'min(960px, 95vw)', boxShadow: '0 20px 80px rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div id="wallpaper-panel-title" style={{ fontWeight: 700, fontSize: '1.05rem' }}>Chat Wallpapers</div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Applies only to this conversation for you</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer' }}>Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', padding: '16px', background: '#0b1220' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>Preset wallpapers</div>
              <button
                onClick={() => applyChange(DEFAULT_WALLPAPER)}
                style={{ fontSize: '0.85rem', color: '#38bdf8', background: 'none', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '999px', padding: '6px 12px', cursor: 'pointer' }}
              >
                Restore default
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {presets.map((preset) => {
                const active = draft.sourceType === 'preset' && draft.presetKey === preset.key;
                const previewBg = (typeof preset.value === 'string' && (preset.value.startsWith('linear-gradient') || preset.value.startsWith('radial-gradient')))
                  ? preset.value
                  : '';
                return (
                  <button
                    key={preset.key}
                    onClick={() => selectPreset(preset)}
                    style={{
                      position: 'relative',
                      border: active ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      height: '96px',
                      cursor: 'pointer',
                      backgroundImage: previewBg,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      boxShadow: active ? '0 0 0 6px rgba(56,189,248,0.12)' : 'none'
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45))' }} />
                    <span style={{ position: 'absolute', left: '10px', bottom: '10px', fontWeight: 700, color: '#f8fafc', textShadow: '0 4px 12px rgba(0,0,0,0.35)' }}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gap: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontWeight: 600 }}>Custom image</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: '#1d4ed8', color: '#e0f2fe', border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}
                  disabled={saving}
                >
                  {saving ? 'Uploading...' : 'Upload image'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onUpload) {
                      onUpload(file);
                    }
                  }}
                />
                <div style={{ flex: 1, minWidth: '240px', display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Paste image URL"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    style={{ flex: 1, background: '#0b1324', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}
                  />
                  <button
                    type="button"
                    onClick={handleCustomUrlApply}
                    disabled={!customUrl.trim()}
                    style={{ background: '#0ea5e9', color: '#e0f2fe', border: 'none', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600, opacity: customUrl.trim() ? 1 : 0.6 }}
                  >
                    Use
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => applyChange({ sourceType: 'none', presetKey: 'none', imageUrl: '' })}
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#fecdd3', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Disable
                </button>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', display: 'grid', gap: '12px' }}>
            <div style={{ fontWeight: 700 }}>Preview</div>
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', height: '240px', background: '#111827' }}>
              <div style={{ position: 'absolute', inset: 0, background: getPreviewBackground(), backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${draft.blur || 0}px)`, opacity: draft.opacity ?? 0.9, transition: 'all 0.2s ease' }} />
              {draft.sourceType === 'custom' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
                  Custom wallpaper preview will appear in chat after saving
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.45))' }} />
              <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontWeight: 700 }}>
                Conversation background
              </div>
            </div>

            <label style={{ display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Blur</span>
                <span style={{ color: '#94a3b8' }}>{draft.blur || 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                step="1"
                value={draft.blur || 0}
                onChange={(e) => applyChange({ blur: Number(e.target.value) })}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Opacity</span>
                <span style={{ color: '#94a3b8' }}>{Math.round((draft.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={draft.opacity ?? 1}
                onChange={(e) => applyChange({ opacity: Number(e.target.value) })}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onReset}
                style={{ background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer' }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => onSave?.(draft)}
                disabled={saving}
                style={{ background: '#22c55e', color: '#052e16', border: 'none', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : 'Save wallpaper'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
