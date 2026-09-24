import { cn } from '../../../../shared/lib/cn';
import { TemplateThumbnail } from '../TemplateThumbnail';
import { TEMPLATES } from '../../lib/pagination/template-layouts';

interface Props {
  selectedTemplate: string;
  primaryColor: string;
  onRequestTemplateChange: (templateId: string) => void;
}

/** The template cards of the Design tab. Extracted from DesignTab, over its size limit. */
export function TemplatePicker({ selectedTemplate, primaryColor, onRequestTemplateChange }: Props) {
  return (
    <section className="stitch-panel">
      <div className="stitch-panel-header">Templates</div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            onClick={() => {
              if (selectedTemplate !== tpl.id) onRequestTemplateChange(tpl.id);
            }}
            className={cn(
              "stitch-panel p-2 cursor-pointer transition-all flex flex-col gap-2",
              selectedTemplate === tpl.id ? "border-blue-600 ring-1 ring-blue-600 bg-blue-50/30" : "opacity-60 hover:opacity-100 hover:bg-gray-50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("text-[11px] font-bold stitch-mono uppercase", selectedTemplate === tpl.id ? "text-blue-600" : "text-gray-900")}>{tpl.name}</span>
              {selectedTemplate === tpl.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </div>
            <div className="h-16 bg-white border border-gray-100 rounded overflow-hidden">
              <TemplateThumbnail templateId={tpl.id} primaryColor={primaryColor} />
            </div>
            <span className="text-[11px] text-gray-500 uppercase leading-tight">{tpl.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
