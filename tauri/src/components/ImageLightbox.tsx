import { useEffect } from "react";

export default function ImageLightbox({
  src,
  caption,
  onClose,
}: {
  src: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={caption ?? "Alert image"}
          className="max-w-full max-h-[80vh] rounded shadow-2xl object-contain bg-ink"
        />
        {caption && (
          <p className="text-paper/80 text-xs font-mono">{caption}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-paper text-ink text-lg leading-none hover:bg-cream"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
