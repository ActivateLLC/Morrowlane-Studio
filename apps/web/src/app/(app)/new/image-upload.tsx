'use client';

import { useRef, useState } from 'react';

/**
 * A phone photo is 2–8MB; the server skipped anything over ~1MB and said nothing, so
 * users believed Morrowlane had their logo when it did not. Rather than only warning,
 * this downscales in the browser and puts the smaller file back on the input, so the
 * common case simply works. If a file still cannot be shrunk enough, it says so.
 */
export function ImageUpload({
  name,
  label,
  multiple = false,
  maxBytes,
}: {
  name: string;
  label: string;
  multiple?: boolean;
  maxBytes: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function handleChange() {
    const input = inputRef.current;
    if (!input?.files?.length) return;
    setWorking(true);
    setNotice(null);

    const processed: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(input.files)) {
      if (file.size <= maxBytes) {
        processed.push(file);
        continue;
      }
      const smaller = await downscale(file, maxBytes);
      if (smaller) processed.push(smaller);
      else rejected.push(file.name);
    }

    // Put the shrunk files back so the form submits those instead of the originals.
    const transfer = new DataTransfer();
    for (const file of processed) transfer.items.add(file);
    input.files = transfer.files;

    setWorking(false);
    if (rejected.length > 0) {
      setNotice(`Couldn't shrink ${rejected.join(', ')} enough — try a screenshot or a smaller export.`);
    } else if (processed.length > 0) {
      setNotice(`${processed.length} ${processed.length === 1 ? 'image' : 'images'} ready.`);
    }
  }

  return (
    <label className="flex flex-col gap-1 text-[12px] text-ink-soft">
      {label}
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        multiple={multiple}
        onChange={handleChange}
        className="text-[12px]"
      />
      {working ? <span className="text-[11px] text-ink-faint">Resizing…</span> : null}
      {notice ? (
        <span className="text-[11px] text-ink-faint" role="status">
          {notice}
        </span>
      ) : null}
    </label>
  );
}

/** Draws the image progressively smaller until it fits, or gives up honestly. */
async function downscale(file: File, maxBytes: number): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    for (const maxEdge of [1600, 1200, 900, 600]) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.82),
      );
      if (blob && blob.size <= maxBytes) {
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
      }
    }
    return null;
  } catch {
    return null;
  }
}
