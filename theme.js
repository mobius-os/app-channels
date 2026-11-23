// Channels — scoped stylesheet. Every colour comes from the shell's theme
// tokens, so it reads in light and dark alike.
export const CSS = `
* { box-sizing: border-box; }
.ch-root { position: relative; display: flex; flex-direction: column; height: 100%; width: 100%;
  overflow: hidden; background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased; }
.ch-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.ch-inner { width: 100%; max-width: 720px; margin-inline: auto; padding: 4px 16px 48px;
  display: flex; flex-direction: column; gap: 14px; overflow-wrap: anywhere; }

.ch-header { flex: 0 0 auto; }
.ch-header-inner { width: 100%; max-width: 720px; margin-inline: auto; display: flex; align-items: center;
  justify-content: space-between; gap: 12px; padding: max(14px, env(safe-area-inset-top)) 16px 12px; }
.ch-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ch-brand img { width: 38px; height: 38px; border-radius: 10px; flex: none; }
.ch-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.015em; }
.ch-subtitle { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

.ch-lede { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
.ch-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 4px; }
.ch-section-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em; }

.ch-btn { min-height: 40px; padding: 0 16px; border-radius: 10px; border: 1px solid transparent;
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  background: var(--accent-fill, var(--accent)); color: var(--accent-fg, #fff);
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.ch-btn:hover:not(:disabled) { background: var(--accent-fill-hover, var(--accent-fill, var(--accent))); }
.ch-btn:disabled { opacity: 0.5; cursor: default; }
.ch-btn--quiet { background: transparent; color: var(--text); border-color: var(--border); }
.ch-btn--quiet:hover:not(:disabled) { background: var(--surface-2); }
.ch-btn--danger { background: transparent; color: var(--danger-text, var(--danger)); border-color: var(--border); }
.ch-btn--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--danger) 10%, transparent); }
.ch-btn--danger-fill { background: var(--danger-fill, var(--danger)); color: #fff; }
.ch-btn:focus-visible, .ch-row:focus-visible, .ch-tile:focus-visible, .ch-seg button:focus-visible,
.ch-chip:focus-visible, .ch-switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ch-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.ch-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px;
  background: var(--surface); overflow: hidden; }
.ch-item + .ch-item { border-top: 1px solid var(--border); }
.ch-row { width: 100%; min-height: 64px; display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  background: transparent; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ch-row:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
.ch-mark { flex: none; width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center;
  background: var(--surface-2); color: var(--text); }
.ch-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ch-row-title { font-size: 15px; font-weight: 600; }
.ch-row-sub { color: var(--muted); font-size: 13px; line-height: 1.4; }
.ch-feeds { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.ch-tag { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 500; background: var(--surface-2); color: var(--text); }
.ch-tag--off { color: var(--muted); }
.ch-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  vertical-align: 1px; background: var(--muted); }
.ch-dot--ok { background: var(--green, #2fa866); }
.ch-dot--bad { background: var(--danger); }
.ch-bad { color: var(--danger-text, var(--danger)); }
.ch-badge { flex: none; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600;
  background: var(--danger-fill, var(--danger)); color: #fff; }
.ch-chevron { flex: none; color: var(--muted); font-size: 22px; line-height: 1; transition: transform .15s ease; }
.ch-chevron--open { transform: rotate(90deg); }

.ch-panel { display: flex; flex-direction: column; gap: 16px; padding: 4px 14px 16px 64px; }
@media (max-width: 520px) { .ch-panel { padding-left: 14px; } }
.ch-feed { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px;
  background: var(--surface-2); }
.ch-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ch-switch-title { display: block; font-size: 14px; font-weight: 600; }
.ch-hint { display: block; margin: 2px 0 0; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
.ch-switch { flex: none; position: relative; width: 44px; height: 26px; border-radius: 999px; border: 0;
  background: color-mix(in srgb, var(--text) 22%, transparent); cursor: pointer; padding: 0;
  transition: background .15s ease; }
.ch-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s ease; }
.ch-switch[aria-checked="true"] { background: var(--accent-fill, var(--accent)); }
.ch-switch[aria-checked="true"]::after { transform: translateX(18px); }
.ch-switch:disabled { opacity: .5; cursor: default; }

.ch-seg { display: inline-flex; align-self: flex-start; flex-wrap: wrap; gap: 2px; padding: 3px;
  border-radius: 10px; background: var(--surface); border: 1px solid var(--border); }
.ch-seg button { min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent;
  color: var(--muted); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.ch-seg button[aria-checked="true"] { background: var(--surface-2); color: var(--text);
  box-shadow: 0 1px 2px rgba(0,0,0,.15); }
.ch-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ch-chip { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; }
.ch-chip[aria-pressed="true"] { border-color: var(--accent); color: var(--accent-text, var(--accent));
  background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }

.ch-activity { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.ch-activity li { display: grid; grid-template-columns: 76px 1fr; gap: 10px; padding: 6px 0;
  font-size: 13px; line-height: 1.4; }
.ch-activity li + li { border-top: 1px solid var(--border); }
.ch-when { color: var(--muted); font-variant-numeric: tabular-nums; }
.ch-what { min-width: 0; }
.ch-source { color: var(--muted); }
.ch-empty { margin: 0; color: var(--muted); font-size: 13px; }

.ch-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px;
  border: 1px solid var(--border); background: var(--surface); }
.ch-card-title { margin: 0; font-size: 16px; font-weight: 700; }
.ch-progress { display: flex; gap: 6px; }
.ch-progress span { flex: 1; height: 4px; border-radius: 4px; background: var(--border); transition: background .2s ease; }
.ch-progress .on { background: var(--accent); }
.ch-step { margin: 6px 0 0; font-size: 13px; font-weight: 600; }
.ch-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 520px) { .ch-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ch-tile { min-height: 76px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface);
  color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.ch-tile[aria-checked="true"] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.ch-guide { margin: 0; padding-left: 20px; color: var(--muted); font-size: 13px; line-height: 1.55; }
.ch-guide li + li { margin-top: 4px; }
.ch-guide b { color: var(--text); font-weight: 600; }
.ch-input { width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font: inherit; font-size: 16px; outline: none; }
.ch-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.ch-input--ok { border-color: var(--green, #2fa866); }
.ch-input--bad { border-color: var(--danger); }
.ch-check { margin: -4px 0 0; color: var(--muted); font-size: 12.5px; }
.ch-check--ok { color: var(--green-text, var(--green, #2fa866)); }
.ch-check--bad { color: var(--danger-text, var(--danger)); }

.ch-notice { padding: 10px 12px; border-radius: 10px; font-size: 13.5px; line-height: 1.45;
  background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.ch-notice--bad { background: color-mix(in srgb, var(--danger) 12%, var(--surface)); color: var(--danger-text, var(--danger)); }
.ch-notice--ok { background: color-mix(in srgb, var(--green, #2fa866) 12%, var(--surface)); }
.ch-confirm { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border)); }
.ch-confirm p { margin: 0; font-size: 13.5px; }
.ch-loading { padding: 32px 0; color: var(--muted); text-align: center; font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
  .ch-switch, .ch-switch::after, .ch-chevron, .ch-progress span { transition: none; }
}
`
