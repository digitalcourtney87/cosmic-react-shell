interface OverdueBannerProps {
  hiddenCount: number;
  onShow: () => void;
}

const OverdueBanner = ({ hiddenCount, onShow }: OverdueBannerProps) => {
  if (hiddenCount <= 0) return null;
  const word = hiddenCount === 1 ? "case" : "cases";
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 border-l-4 border-gds-amber bg-gds-amber/10 px-4 py-3 text-sm"
    >
      <span className="text-gds-black">
        <strong className="font-semibold">{hiddenCount} overdue {word}</strong> hidden by current
        filter.
      </span>
      <button
        type="button"
        onClick={onShow}
        className="font-semibold text-gds-blue hover:underline underline-offset-2"
      >
        Show
      </button>
    </div>
  );
};

export default OverdueBanner;
