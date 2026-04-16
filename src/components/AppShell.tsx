import { Link, Outlet, useLocation, useParams } from "react-router-dom";

const AppShell = () => {
  const location = useLocation();
  const params = useParams();

  const onCaseDetail = /^\/case\/[^/]+$/.test(location.pathname);
  const onActionStub = /^\/case\/[^/]+\/action\/[^/]+$/.test(location.pathname);
  const caseId = params.caseId;

  return (
    <div className="min-h-screen flex flex-col bg-white text-gds-black">
      <header className="sticky top-0 z-40 bg-gds-black border-b-4 border-gds-yellow">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="text-white text-xl font-bold tracking-tight no-underline"
          >
            Case Compass
          </Link>
          <nav>
            <Link
              to="/"
              className="text-white text-sm font-medium hover:underline underline-offset-4"
            >
              All cases
            </Link>
          </nav>
        </div>
      </header>

      {(onCaseDetail || onActionStub) && (
        <nav
          aria-label="Breadcrumb"
          className="border-b border-gds-lightgrey bg-white"
        >
          <ol className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-2 text-sm">
            <li>
              <Link to="/" className="text-gds-blue hover:underline">
                All cases
              </Link>
            </li>
            <li className="text-gds-midgrey" aria-hidden="true">
              ›
            </li>
            <li>
              {onActionStub ? (
                <Link to={`/case/${caseId}`} className="text-gds-blue hover:underline">
                  {caseId}
                </Link>
              ) : (
                <span className="text-gds-black font-medium">{caseId}</span>
              )}
            </li>
            {onActionStub && (
              <>
                <li className="text-gds-midgrey" aria-hidden="true">
                  ›
                </li>
                <li className="text-gds-black font-medium">Action</li>
              </>
            )}
          </ol>
        </nav>
      )}

      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gds-lightgrey bg-gds-lightgrey">
        <div className="mx-auto max-w-7xl px-6 py-4 text-sm text-gds-midgrey">
          Case Compass — hackathon prototype. Read-only demo over fixture data.
        </div>
      </footer>
    </div>
  );
};

export default AppShell;
