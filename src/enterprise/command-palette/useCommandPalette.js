import { useCallback, useEffect, useMemo, useState } from 'react';
import { COMMANDS } from './commands.config';

/**
 * useCommandPalette
 *
 * Manages open/closed state, a Ctrl+K (and Cmd+K on Mac) global
 * listener, and simple label/keyword filtering over the config-driven
 * command list. Navigation itself is left to the consumer (pass an
 * `onNavigate` callback, e.g. a react-router `navigate`) so this hook
 * has zero routing/framework dependency.
 *
 * @param {{ onNavigate?: (path: string) => void }} [options]
 */
export function useCommandPalette(options = {}) {
  const { onNavigate } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setSearch('');
  }, []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    function handleKeyDown(e) {
      const isCtrlOrCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (isCtrlOrCmdK) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredCommands = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return COMMANDS;
    return COMMANDS.filter((cmd) => {
      const haystack = [cmd.label, ...(cmd.keywords || [])].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [search]);

  const runCommand = useCallback((command) => {
    if (onNavigate && command?.path) {
      onNavigate(command.path);
    }
    close();
  }, [onNavigate, close]);

  return {
    isOpen,
    open,
    close,
    toggle,
    search,
    setSearch,
    commands: filteredCommands,
    runCommand,
  };
}
