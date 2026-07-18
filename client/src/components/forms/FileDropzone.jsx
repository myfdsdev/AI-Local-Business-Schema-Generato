import { useCallback, useId, useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const DEFAULT_ACCEPT = ['.pdf', '.docx', '.txt', '.md', '.pptx', '.xlsx', '.xls', '.epub', '.csv'];
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 10;

function extensionOf(name = '') {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Multi-file drag-and-drop uploader. Controlled: the parent owns the `files`
 * array and receives changes via `onChange`. Validation (type + size + count)
 * runs here so invalid files never reach the parent; rejects are reported
 * through `onReject` for a toast.
 */
export function FileDropzone({
  files,
  onChange,
  onReject,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX_BYTES,
  maxFiles = DEFAULT_MAX_FILES,
  disabled = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [isDragging, setDragging] = useState(false);

  const acceptAttr = accept.join(',');

  const addFiles = useCallback(
    (incoming) => {
      const rejections = [];
      const accepted = [];

      for (const file of incoming) {
        const ext = extensionOf(file.name);
        if (!accept.includes(ext)) {
          rejections.push(`${file.name}: unsupported type`);
        } else if (file.size > maxBytes) {
          rejections.push(`${file.name}: over ${formatSize(maxBytes)}`);
        } else if (
          // Skip exact duplicates already in the list.
          files.some((existing) => existing.name === file.name && existing.size === file.size)
        ) {
          rejections.push(`${file.name}: already added`);
        } else {
          accepted.push(file);
        }
      }

      const room = maxFiles - files.length;
      const withinLimit = accepted.slice(0, Math.max(0, room));
      if (accepted.length > withinLimit.length) {
        rejections.push(`Only ${maxFiles} files allowed at once`);
      }

      if (withinLimit.length) onChange([...files, ...withinLimit]);
      if (rejections.length && onReject) onReject(rejections);
    },
    [accept, files, maxBytes, maxFiles, onChange, onReject],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      if (disabled) return;
      addFiles([...event.dataTransfer.files]);
    },
    [addFiles, disabled],
  );

  const handleSelect = (event) => {
    addFiles([...event.target.files]);
    event.target.value = ''; // allow re-selecting the same file
  };

  const removeAt = (index) => onChange(files.filter((_, current) => current !== index));

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/40',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Drag multiple files here, or <span className="text-primary">select to upload</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Supports {accept.join(', ')} · Max {formatSize(maxBytes)} per file
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={acceptAttr}
          className="sr-only"
          onChange={handleSelect}
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FileDropzone;
