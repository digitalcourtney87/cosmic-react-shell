import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { PolicyExtract } from '@/types/case';

interface PolicyExcerptsProps {
  policyRefs: string[];
  policies: PolicyExtract[];
}

export default function PolicyExcerpts({ policyRefs, policies }: PolicyExcerptsProps) {
  if (policyRefs.length === 0) return null;

  const defaultOpen = policyRefs[0];

  return (
    <div className="bg-white rounded shadow-sm px-6 py-5">
      <h2 className="font-bold text-sm uppercase text-gray-600 mb-3 tracking-wide">
        Policy excerpts
      </h2>
      <Accordion type="single" collapsible defaultValue={defaultOpen}>
        {policyRefs.map(id => {
          const policy = policies.find(p => p.policy_id === id);
          return (
            <AccordionItem key={id} value={id}>
              {policy ? (
                <>
                  <AccordionTrigger className="text-sm font-semibold text-left">
                    <span className="font-mono text-xs mr-2" style={{ color: '#1d70b8' }}>{id}</span>
                    <span className="text-gray-800">{policy.title}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {policy.body}
                    </p>
                  </AccordionContent>
                </>
              ) : (
                <>
                  <AccordionTrigger className="text-sm font-semibold text-left">
                    <span className="font-mono text-xs mr-2 text-gray-400">{id}</span>
                    <span className="text-gray-400">Policy {id} — not extracted in fixture</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-400 italic">
                      No policy extract available for {id}.
                    </p>
                  </AccordionContent>
                </>
              )}
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
