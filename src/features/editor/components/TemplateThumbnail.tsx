// Static mini-preview of each template's real layout (replaces the old
// flat color rectangles that showed nothing of the actual structure).

interface Props {
  templateId: string;
  primaryColor: string;
}

/** Grey text-line placeholder */
function Lines({ n, w = 'w-full' }: { n: number; w?: string }) {
  return (
    <div className="space-y-[2px]">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`h-[2px] rounded-full bg-gray-300 ${i === n - 1 ? 'w-2/3' : w}`} />
      ))}
    </div>
  );
}

export function TemplateThumbnail({ templateId, primaryColor }: Props) {
  // C: single centered column. E (default): single column, header band.
  if (templateId === 'TEMPLATE_C') {
    return (
      <div className="w-full h-full bg-white p-1 flex flex-col items-center space-y-1.5">
        <div className="h-[3px] rounded-full w-1/3" style={{ backgroundColor: primaryColor }} />
        <div className="h-[2px] rounded-full bg-gray-300 w-1/2" />
        <div className="w-full space-y-[2px] pt-0.5">
          <div className="h-[2px] rounded-full bg-gray-300" />
          <div className="h-[2px] rounded-full bg-gray-300" />
          <div className="h-[2px] rounded-full bg-gray-300 w-3/4" />
        </div>
        <div className="w-full flex gap-1 pt-0.5">
          <div className="flex-1"><Lines n={2} /></div>
          <div className="flex-1"><Lines n={2} /></div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-white p-1 space-y-1.5">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-gray-200" />
        <div className="flex-1 space-y-[2px]">
          <div className="h-[3px] rounded-full w-2/3" style={{ backgroundColor: primaryColor }} />
          <div className="h-[2px] rounded-full bg-gray-300 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1">
        <div className="w-[3px] rounded-full self-stretch" style={{ backgroundColor: primaryColor }} />
        <div className="flex-1"><Lines n={3} /></div>
      </div>
      <div className="flex gap-1">
        <div className="w-[3px] rounded-full self-stretch" style={{ backgroundColor: primaryColor }} />
        <div className="flex-1"><Lines n={2} /></div>
      </div>
    </div>
  );
}
