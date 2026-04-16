import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <section className="py-12">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-gds-midgrey">
        We could not find anything at <code className="font-mono">{location.pathname}</code>.
      </p>
      <p className="mt-6">
        <Link to="/" className="text-gds-blue hover:underline">
          ← Back to all cases
        </Link>
      </p>
    </section>
  );
};

export default NotFound;
