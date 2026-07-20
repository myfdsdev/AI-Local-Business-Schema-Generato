import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

/**
 * Loads a Lottie JSON from /public at runtime rather than importing it, so the
 * animation (186 KB) stays out of the main JS bundle and is cached separately.
 *
 * Renders nothing until it loads, and nothing at all if the fetch fails — a
 * decorative animation must never break the page it sits on. Also honours
 * prefers-reduced-motion by holding on the first frame.
 */
export function LottieAnimation({ src, className, loop = true }) {
  const [animationData, setAnimationData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed || !animationData) return null;

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Lottie
      animationData={animationData}
      loop={reduceMotion ? false : loop}
      autoplay={!reduceMotion}
      className={className}
      aria-hidden="true"
    />
  );
}

export default LottieAnimation;
