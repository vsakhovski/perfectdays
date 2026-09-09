import { useLayoutEffect, useState, type RefObject } from 'react';

import styles from './ScrollIndicator.module.css';

interface ScrollIndicatorProps {
  readonly scrollRef: RefObject<HTMLElement | null>;
}

export function ScrollIndicator({ scrollRef }: ScrollIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const measure = () => {
      setVisible(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 8);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    const observeChildren = () => {
      resize?.disconnect();
      resize?.observe(scroller);
      for (const child of scroller.children) resize?.observe(child);
    };
    const mutations = new MutationObserver(() => {
      observeChildren();
      schedule();
    });
    observeChildren();
    mutations.observe(scroller, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    scroller.addEventListener('scroll', schedule, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations.disconnect();
      scroller.removeEventListener('scroll', schedule);
    };
  }, [scrollRef]);

  return <div aria-hidden="true" className={styles['indicator']} hidden={!visible} />;
}
