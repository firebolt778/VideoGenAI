import React, { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

function TopScrollBarProvider({
  children,
  ...props
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const childrenRef = useRef<HTMLDivElement | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const scrollbarContainerRef = useRef<HTMLDivElement | null>(null);

  const syncScrollBar = (e: any) => {
    if (!scrollbarContainerRef.current || !containerRef.current) {
      return;
    }
    scrollbarContainerRef.current.scrollTo(containerRef.current.scrollLeft, 0);
  }
  const syncContainer = (e: any) => {
    if (!scrollbarContainerRef.current || !containerRef.current) {
      return;
    }
    containerRef.current.scrollTo(scrollbarContainerRef.current.scrollLeft, 0);
  }
  const resetScrollbarWidth = () => {
    if (!scrollbarRef.current || !childrenRef.current) {
      return;
    }
    scrollbarRef.current.style.width = `${childrenRef.current.offsetWidth}px`;
  }
  useEffect(() => {
    resetScrollbarWidth();
  }, [scrollbarRef.current, childrenRef.current]);

  return (
    <>
      <div
        className="w-full overflow-x-auto"
        onScroll={syncContainer}
        ref={scrollbarContainerRef}
      >
        <div className="h-0.5" ref={scrollbarRef} />
      </div>
      <div
        className={cn("overflow-x-auto", props.className)}
        ref={containerRef}
        onScroll={syncScrollBar}
        {...props}
      >
        <div className="min-w-full table" ref={childrenRef}>
          {children}
        </div>
      </div>
    </>
  )
}

export { TopScrollBarProvider }
