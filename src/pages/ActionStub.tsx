import { Link, useParams } from "react-router-dom";

const ActionStub = () => {
  const { caseId, actionId } = useParams<{ caseId: string; actionId: string }>();

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">Action: {actionId}</h1>
      <p className="mt-2 text-gds-midgrey">
        Stream B placeholder. Read-only action stub renders here.
      </p>
      <p className="mt-6">
        <Link to={`/case/${caseId}`} className="text-gds-blue hover:underline">
          ← Back to {caseId}
        </Link>
      </p>
    </section>
  );
};

export default ActionStub;
