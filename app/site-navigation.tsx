/* eslint-disable @next/next/no-html-link-for-pages -- View tabs use full navigation so the archive route cannot stall an RSC transition. */

export default function SiteNavigation({
  active,
}: {
  active: "db" | "mapping";
}) {
  return (
    <>
      <header className="site-header">
        <a
          className="wordmark"
          href="/"
          aria-label="Criterion Closet DB home"
        >
          CCDB
        </a>
        <span className="site-title">Criterion Closet DB</span>
        <a
          className="maker-link"
          href="https://www.nbaronia.com"
          target="_blank"
          rel="noreferrer"
        >
          Made by nbaronia ↗
        </a>
      </header>

      <nav className="view-tabs" aria-label="Primary views">
        <a
          className={`view-tab${active === "db" ? " view-tab--active" : ""}`}
          href="/"
          aria-current={active === "db" ? "page" : undefined}
        >
          DB
        </a>
        <a
          className={`view-tab${
            active === "mapping" ? " view-tab--active" : ""
          }`}
          href="/semantic-islands"
          aria-current={active === "mapping" ? "page" : undefined}
        >
          Semantic Map
        </a>
      </nav>
    </>
  );
}
