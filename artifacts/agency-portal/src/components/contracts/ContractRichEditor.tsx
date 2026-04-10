import { useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  readOnly?: boolean;
  /** Es. salvataggio immediato su uscita dal campo (autosave). */
  onBlur?: () => void;
};

export function ContractRichEditor({ value, onChange, className, readOnly, onBlur }: Props) {
  const mods = useMemo(() => modules, []);
  return (
    <div
      className={cn(
        "contract-rich-editor rounded-lg border border-input bg-background overflow-hidden [&_.ql-container]:min-h-[220px] [&_.ql-editor]:min-h-[200px] [&_.ql-toolbar]:border-input [&_.ql-container]:border-input",
        className,
      )}
    >
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        modules={mods}
        readOnly={readOnly}
      />
    </div>
  );
}
