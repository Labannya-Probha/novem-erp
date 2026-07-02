import React from 'react';
import { useCommandPalette } from './useCommandPalette';

/**
 * CommandPalette
 *
 * Ctrl+K / Cmd+K activated modal listing safe, config-driven navigation
 * commands (see commands.config.js). Contains no destructive actions.
 *
 * @param {{ onNavigate?: (path: string) => void }} props
 *   `onNavigate` should be wired to your router's navigate function,
 *   e.g. `onNavigate={(path) => navigate(path)}` from react-router.
 *   If omitted, the palette renders but selecting a command is a no-op.
 */
export default function CommandPalette({ onNavigate }) {
  const { isOpen, close, search, setSearch, commands, runCommand } =
    useCommandPalette({ onNavigate });

  if (!isOpen) return null;

  return (
    <div
      className="aera-command-palette-overlay"
      role="presentation"
      onClick={close}
    >
      <div
        className="aera-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <label htmlFor="aera-command-palette-input" className="sr-only">
          Type a command
        </label>
        <input
          id="aera-command-palette-input"
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a command… (Esc to close)"
          aria-label="Command search"
          autoComplete="off"
        />

        <ul role="listbox" aria-label="Available commands">
          {commands.length === 0 ? (
            <li className="aera-empty-state" role="status">
              No matching commands.
            </li>
          ) : (
            commands.map((cmd) => (
              <li key={cmd.id} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => runCommand(cmd)}
                  aria-label={cmd.label}
                >
                  {cmd.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
