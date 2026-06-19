"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#121212]/90 backdrop-blur-md" : ""
      }`}
    >
      <div className="px-5 sm:px-8 lg:px-10 flex items-center justify-between h-14 sm:h-16 sm:mt-2">
        <Link
          href="/"
          onClick={handleLogoClick}
          aria-label="Go to homepage"
          className="cursor-pointer select-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Maenad"
            draggable={false}
            className="select-none h-9 sm:h-11 w-auto"
            style={{ WebkitUserDrag: "none", userSelect: "none" } as React.CSSProperties}
          />
        </Link>

      </div>
    </nav>
  );
}
