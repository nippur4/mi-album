// Singleton de "now" tickeando cada segundo.
//
// Cualquier número de componentes que usen useNow() comparten un único
// setInterval. Cuando el último componente se desmonta, el interval se
// limpia. Evita N timers en pantallas como el tab Sobres que listan varios
// countdowns simultáneos.

import { useEffect, useState } from 'react';

const subs = new Set<(now: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureInterval() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    const now = Date.now();
    for (const fn of subs) fn(now);
  }, 1000);
}

function maybeClearInterval() {
  if (subs.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    subs.add(setNow);
    ensureInterval();
    return () => {
      subs.delete(setNow);
      maybeClearInterval();
    };
  }, []);
  return now;
}
