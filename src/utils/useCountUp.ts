import { useEffect, useRef, useState } from 'react'

/** Animate a number toward `target` (from 0 on first paint, unless `skipIntro`). */
export function useCountUp(
  target: number,
  durationMs = 1200,
  { skipIntro = false }: { skipIntro?: boolean } = {},
): number {
  const [value, setValue] = useState(() => (skipIntro ? target : 0))
  const currentRef = useRef(skipIntro ? target : 0)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = currentRef.current
    const to = target
    if (from === to) {
      setValue(to)
      return
    }

    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      const next = from + (to - from) * eased
      currentRef.current = next
      setValue(next)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        currentRef.current = to
        setValue(to)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, durationMs])

  return value
}
