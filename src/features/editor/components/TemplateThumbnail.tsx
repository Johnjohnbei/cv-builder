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
  // A: two columns, sidebar right. B: dark sidebar left. C: single centered. E: single, header band.
  if (templateId === 'TEMPLATE_B') {
    return (
      <div className="w-full h-full flex bg-white">
        <div className="w-1/3 h-full p-1 space-y-1" style={{ backgroundColor: primaryColor }}>
          <div className="w-3 h-3 rounded-full bg-white/40 mx-auto" />
          <div className="h-[2px] rounded-full bg-white/50" />
          <div className="h-[2px] rounded-full bg-white/50 w-2/3" />
        </div>
        <div className="flex-1 p-1 space-y-1.5">
          <div className="h-[3px] rounded-full w-1/2" style={{ backgroundColor: primaryColor }} />
          <Lines n={3} />
          <Lines n={2} />
        </div>
      </div>
    );
  }
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
  if (templateId === 'TEMPLATE_E') {
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
  // TEMPLATE_A (default): header band + main column with sidebar right
  return (
    <div className="w-full h-full bg-white p-1 space-y-1">
      <div className="space-y-[2px] border-b pb-0.5" style={{ borderColor: primaryColor }}>
        <div className="h-[3px] rounded-full w-1/2" style={{ backgroundColor: primaryColor }} />
        <div className="h-[2px] rounded-full bg-gray-300 w-1/3" />
      </div>
      <div className="flex gap-1">
        <div className="flex-[2] space-y-1">
          <Lines n={3} />
          <Lines n={2} />
        </div>
        <div className="flex-1 space-y-[2px]">
          <div className="h-[2px] rounded-full bg-gray-200" />
          <div className="h-[2px] rounded-full bg-gray-200" />
          <div className="h-[2px] rounded-full bg-gray-200 w-2/3" />
        </div>
      </div>
    </div>
  );
}
