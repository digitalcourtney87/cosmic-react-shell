import { useParams } from "react-router-dom";

const CaseDetail = () => {
  const { caseId } = useParams<{ caseId: string }>();

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">{caseId}</h1>
      <p className="mt-2 text-gds-midgrey">
        Stream B placeholder. Case detail panels render here.
      </p>
    </section>
  );
};

export default CaseDetail;
