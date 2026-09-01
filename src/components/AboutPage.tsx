import { useEffect, useState, type ReactNode } from 'react'
import { CONTACT_EMAIL } from '../config/site'

interface Props {
  notificationCount: number
  countryCount: number
  dataFromYear: string
  dataToYear: string
  embedded?: boolean
  headerClearance?: number
}

type LegalView = 'privacy' | 'terms' | null

const BODY = 'text-[15px] md:text-base text-zinc-400 leading-[1.7]'
const SECTION_TITLE = 'text-xl md:text-[1.375rem] font-medium text-zinc-200 tracking-tight'
const PAGE_TITLE = 'text-2xl md:text-[2.125rem] font-light text-zinc-100 tracking-tight leading-snug'
const LABEL = 'text-[15px] text-zinc-300 font-medium'
const FOOTER_LINK =
  'text-[15px] text-zinc-500 hover:text-zinc-300 transition-colors underline-offset-[3px] hover:underline'

function parseLegalHash(): LegalView {
  const hash = window.location.hash.slice(1)
  if (hash === 'privacy' || hash === 'terms') return hash
  return null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 md:space-y-4">
      <h2 className={SECTION_TITLE}>{title}</h2>
      <div className={`space-y-3 md:space-y-4 ${BODY}`}>{children}</div>
    </section>
  )
}

function ViewItem({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={LABEL}>{name}</p>
      <p>{children}</p>
    </div>
  )
}

function ContactLine() {
  return (
    <p>
      Questions can be directed to{' '}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="text-zinc-200 underline underline-offset-[3px] decoration-zinc-700 hover:decoration-zinc-500 transition-colors"
      >
        {CONTACT_EMAIL}
      </a>
      .
    </p>
  )
}

function AboutFooter({
  activeView,
  onBackToAbout,
}: {
  activeView?: LegalView | 'about'
  onBackToAbout?: () => void
}) {
  const showAboutLink = activeView === 'privacy' || activeView === 'terms'

  return (
    <footer className="pt-8 mt-2 border-t border-zinc-800/60">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showAboutLink && onBackToAbout && (
          <>
            <button type="button" onClick={onBackToAbout} className={FOOTER_LINK}>
              About
            </button>
            <span className="text-zinc-700 select-none" aria-hidden>
              ·
            </span>
          </>
        )}
        <a
          href="#privacy"
          className={activeView === 'privacy' ? 'text-zinc-300' : FOOTER_LINK}
          aria-current={activeView === 'privacy' ? 'page' : undefined}
        >
          Privacy Policy
        </a>
        <span className="text-zinc-700 select-none" aria-hidden>
          ·
        </span>
        <a
          href="#terms"
          className={activeView === 'terms' ? 'text-zinc-300' : FOOTER_LINK}
          aria-current={activeView === 'terms' ? 'page' : undefined}
        >
          Terms of Use
        </a>
      </nav>
    </footer>
  )
}

function PrivacyPolicyContent() {
  return (
    <div className={`space-y-4 md:space-y-5 ${BODY}`}>
      <p>
        Atlas is a public data tool. It does not require an account, collect personal information
        from visitors, or sell or share any data with third parties.
      </p>
      <p>
        <span className={LABEL}>Analytics.</span> Atlas uses basic, aggregated web analytics
        (Vercel Web Analytics) to understand page views and general traffic patterns. This data is
        not tied to individual identities and is not used for advertising.
      </p>
      <p>
        <span className={LABEL}>Cookies.</span> Atlas does not use cookies for tracking or
        advertising purposes. Any cookies present are limited to those required for basic site
        functionality.
      </p>
      <p>
        <span className={LABEL}>Contact.</span> If you reach out to the builder directly (for
        example, by email), any information you share is used only to respond to your message and
        is not stored beyond that purpose or shared with anyone else.
      </p>
      <p>
        <span className={LABEL}>Changes.</span> This policy may be updated as the site evolves.
        Material changes will be reflected on this page.
      </p>
      <ContactLine />
    </div>
  )
}

function TermsOfUseContent() {
  return (
    <div className={`space-y-4 md:space-y-5 ${BODY}`}>
      <p>By using Atlas, you agree to the following:</p>
      <p>
        <span className={LABEL}>Purpose.</span> Atlas is an independent, non-commercial project
        that structures publicly available U.S. Foreign Military Sales congressional notification
        data for research and reference purposes. It is not affiliated with, endorsed by, or
        officially connected to the U.S. government, DSCA, or the Department of State.
      </p>
      <p>
        <span className={LABEL}>Accuracy.</span> Atlas is provided &ldquo;as is,&rdquo; without
        warranty of any kind. While care is taken to accurately parse and structure the underlying
        source data, errors, omissions, or delays are possible. Atlas reflects proposed
        notifications, not signed contracts, final sales, or deliveries, and should not be relied
        on as an official or authoritative source. Always verify critical information against
        original DSCA and State Department releases.
      </p>
      <p>
        <span className={LABEL}>No liability.</span> The builder is not liable for any decisions,
        actions, or conclusions made based on information provided by Atlas.
      </p>
      <p>
        <span className={LABEL}>Use of data.</span> The underlying source data is public record.
        Users are welcome to reference or cite Atlas, though independent verification against
        primary sources is recommended for any formal or published use.
      </p>
      <p>
        <span className={LABEL}>Changes.</span> These terms may be updated as the project evolves.
      </p>
      <ContactLine />
    </div>
  )
}

function formatCount(n: number, step = 50): string {
  const rounded = Math.floor(n / step) * step
  return `${rounded.toLocaleString()}+`
}

export function AboutPage({
  notificationCount,
  countryCount,
  dataFromYear,
  dataToYear,
  embedded = false,
  headerClearance = 180,
}: Props) {
  const topPad = embedded ? headerClearance : 0
  const [legalView, setLegalView] = useState<LegalView>(() => parseLegalHash())

  useEffect(() => {
    const sync = () => setLegalView(parseLegalHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    document.title =
      legalView === 'privacy'
        ? 'Privacy | Atlas'
        : legalView === 'terms'
          ? 'Terms | Atlas'
          : 'About | Atlas'
  }, [legalView])

  const backToAbout = () => {
    window.location.hash = ''
    setLegalView(null)
    window.scrollTo(0, 0)
  }

  if (legalView === 'privacy' || legalView === 'terms') {
    const title = legalView === 'privacy' ? 'Privacy Policy' : 'Terms of Use'
    return (
      <div className="absolute inset-0 overflow-y-auto bg-[#080808]">
        <div
          className="max-w-2xl mx-auto px-5 md:px-8 pb-14 md:pb-20"
          style={{ paddingTop: topPad + 28 }}
        >
          <header className="mb-8 md:mb-10 pb-6 border-b border-zinc-800/60 space-y-1.5">
            <h1 className={PAGE_TITLE}>{title}</h1>
            <p className="text-sm md:text-[15px] text-zinc-600">Last updated: September 2026</p>
          </header>
          {legalView === 'privacy' ? <PrivacyPolicyContent /> : <TermsOfUseContent />}
          <AboutFooter activeView={legalView} onBackToAbout={backToAbout} />
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#080808]">
      <div
        className="max-w-2xl mx-auto px-5 md:px-8 pb-14 md:pb-20"
        style={{ paddingTop: topPad + 28 }}
      >
        <div className="space-y-10 md:space-y-12">
          <Section title="What is Atlas">
            <p>
              Atlas tracks and visualizes U.S. Foreign Military Sales congressional notifications,
              structuring proposed arms-sale packages certified by the Defense Security Cooperation
              Agency (DSCA) and U.S. Department of State into a searchable, filterable public
              dataset. It currently covers {formatCount(notificationCount)} notifications across{' '}
              {formatCount(countryCount, 25)} countries from {dataFromYear} to the present, and is
              updated when new notifications are published and incorporated into the dataset.
            </p>
          </Section>

          <Section title='Why "Atlas"'>
            <p>
              In Greek mythology, Atlas was condemned to bear the weight of the heavens on his
              shoulders, silently and without end, so that the sky would not fall and the world
              could hold its shape.
            </p>
            <p>
              Foreign Military Sales function much the same way. They rarely make headlines, and
              they are easy to overlook against louder, more visible instruments of foreign policy.
              But FMS quietly underwrites the alliance structures, deterrence relationships, and
              security commitments that hold much of the current international order together. Like
              Atlas, that weight is carried mostly out of view.
            </p>
            <p>
              This project is an attempt to make that weight visible, at least in part, by giving
              the public a clear, structured record of what the U.S. government has notified
              Congress it may sell, to whom, and when.
            </p>
          </Section>

          <Section title="Methodology">
            <p>
              Atlas ingests public notifications from DSCA press releases, State Department
              Bureau of Political-Military Affairs releases, and the Federal Register. Each notice
              is parsed into a structured record with country, date, system, estimated value, and
              contractor where one is stated. Records are tagged for filtering by country, timeframe, weapon category, and
              equipment family. The dataset is rebuilt and redeployed as new notifications come in.
            </p>
            <p>
              Dollar figures reflect the highest estimated value stated in each notice. Final
              agreements are often smaller once quantities and scope are negotiated.
            </p>
            <p>
              When a notice names a principal contractor, Atlas parses and normalizes that name,
              merging subsidiaries and aliases where known. Many notices don&apos;t name a commercial
              prime at all, for example when contractors will be selected through competitive
              procurement, or when the package comes from U.S. government or service inventory.
              Atlas does not invent primes from product knowledge.
            </p>
            <p>
              Free-text system lines are mapped into curated equipment families (F-35, Patriot,
              HIMARS, and similar) where a match exists. Unmapped lines fall into a weapon category
              only. Short product blurbs on sale detail cards are editorial summaries meant to help
              with orientation, not official DSCA language.
            </p>
            <p>
              Atlas does not take positions on individual sales or U.S. policy. It exists to make
              the public record easier to navigate, not to advocate for or against any specific
              sale.
            </p>
          </Section>

          <Section title="Views">
            <div className="space-y-4">
              <ViewItem name="Map">
                Recipient countries sized by notified value in the selected year range.
              </ViewItem>
              <ViewItem name="Network">
                Contractors, named equipment, the United States, and recipient countries,
                connected. The default overview uses value thresholds to keep the graph readable.
                Search or focus on a node expands related connections.
              </ViewItem>
              <ViewItem name="Analytics">
                Aggregates over the filtered date range, covering recipients, contractors,
                categories, and trends.
              </ViewItem>
            </div>
          </Section>

          <Section title="Limitations">
            <p>
              Congressional notifications are not signed contracts or deliveries. They are the
              public record of what the U.S. government has told Congress it may sell, along with
              estimated cost and content.
            </p>
            <p>
              Atlas is not a complete picture of U.S. security cooperation. Direct Commercial Sales,
              smaller packages below notification thresholds, classified items, and non-FMS aid are
              all out of scope.
            </p>
            <p>
              Contractor and equipment attribution depend on source text quality and curated
              mappings, so gaps and edge cases remain.
            </p>
            <p>
              Multi-contractor notices split value evenly across named primes for ranking and Network
              edges. This is a modeling choice, not an official cost share.
            </p>
          </Section>

          <Section title="Who built this">
            <p>
              Atlas was built independently by Abhinav Sisodiya, an undergraduate at Indiana
              University with a research interest in defense policy and AI safety. It is a
              self-directed project, not affiliated with any government agency, and any errors are
              the builder&apos;s own. Corrections and feedback are welcome at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-zinc-200 underline underline-offset-[3px] decoration-zinc-700 hover:decoration-zinc-500 transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <AboutFooter activeView="about" />
        </div>
      </div>
    </div>
  )
}
