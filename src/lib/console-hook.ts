interface ElectronAPI {
  log?: {
    send: (level: string, ...args: unknown[]) => void;
  };
}

let hooked = false;

function getElectronAPI(): ElectronAPI | undefined {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}

function stringify(a: unknown): unknown {
  if (a instanceof Error) return a.stack || a.message;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }
  return String(a);
}

function setup(): void {
  if (hooked) return;
  hooked = true;

  const logSend = getElectronAPI()?.log?.send;
  if (!logSend) return;

  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  let sending = false;

  function sendLog(level: string, ...args: unknown[]): void {
    if (sending) return;
    sending = true;
    try {
      (logSend as (level: string, ...args: unknown[]) => void)(level, ...args.map(stringify));
    } catch {
      /* ignore */
    } finally {
      sending = false;
    }
  }

  console.log = (...args: unknown[]) => {
    orig.log(...args);
    sendLog('LOG', ...args);
  };
  console.warn = (...args: unknown[]) => {
    orig.warn(...args);
    sendLog('WARN', ...args);
  };
  console.error = (...args: unknown[]) => {
    orig.error(...args);
    sendLog('ERROR', ...args);
  };
  console.info = (...args: unknown[]) => {
    orig.info(...args);
    sendLog('INFO', ...args);
  };
  console.debug = (...args: unknown[]) => {
    orig.debug(...args);
    sendLog('DEBUG', ...args);
  };
}

setup();
