import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ALL, type FilterState } from "./types";

interface Option {
  value: string;
  label: string;
}

interface FiltersProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  caseTypes: Option[];
  assignees: Option[];
  statuses: Option[];
}

const FilterSelect = ({
  id,
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  allLabel: string;
}) => (
  <div className="flex flex-col gap-1.5 min-w-[180px]">
    <Label htmlFor={id} className="text-xs uppercase tracking-wide text-gds-midgrey font-semibold">
      {label}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="border-gds-midgrey">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const Filters = ({ filters, onChange, caseTypes, assignees, statuses }: FiltersProps) => (
  <div className="flex flex-wrap items-end gap-4">
    <FilterSelect
      id="filter-case-type"
      label="Case type"
      value={filters.caseType}
      options={caseTypes}
      onChange={(v) => onChange({ ...filters, caseType: v })}
      allLabel="All types"
    />
    <FilterSelect
      id="filter-assigned-to"
      label="Assigned to"
      value={filters.assignedTo}
      options={assignees}
      onChange={(v) => onChange({ ...filters, assignedTo: v })}
      allLabel="Anyone"
    />
    <FilterSelect
      id="filter-status"
      label="Status"
      value={filters.status}
      options={statuses}
      onChange={(v) => onChange({ ...filters, status: v })}
      allLabel="Any status"
    />
  </div>
);

export default Filters;
