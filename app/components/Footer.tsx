import ContactModal from "./ContactModal";
import { BG_BASE } from "../lib/site";

const linkClass = "text-xs text-white/35 hover:text-white/70 transition-colors";

const landscapeStacked =
  "[@media(orientation:landscape)_and_(max-height:31.25rem)]:flex-col [@media(orientation:landscape)_and_(max-height:31.25rem)]:items-center [@media(orientation:landscape)_and_(max-height:31.25rem)]:text-center";

function FooterLinks() {
  return (
    <>
      <a
        href="https://maenad-map.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Atlas
      </a>
      <a
        href="https://maenad-map.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        FMS Map
      </a>
      <a href="/mission" className={linkClass}>Mission</a>
      <a href="/privacy" className={linkClass}>Privacy</a>
      <a href="/terms" className={linkClass}>Terms</a>
      <ContactModal />
      <a
        href="https://www.linkedin.com/company/maenad-technologies"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Follow
      </a>
    </>
  );
}

export default function Footer() {
  const copyright = (
    <p className="text-xs text-white/35">© {new Date().getFullYear()} Maenad Technologies Inc. All rights reserved.</p>
  );

  return (
    <footer className={`${BG_BASE} px-5 sm:px-10 py-10 sm:py-8 border-t border-white/[0.08]`}>
      <div
        className={`flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left ${landscapeStacked}`}
      >
        {copyright}
        <div
          className={`flex items-center justify-center gap-x-5 gap-y-3 flex-wrap md:gap-6 md:shrink-0 [@media(orientation:landscape)_and_(max-height:31.25rem)]:justify-center`}
        >
          <FooterLinks />
        </div>
      </div>
    </footer>
  );
}
