export const ACCEPTED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.pptx',
  '.xlsx',
  '.xls',
  '.epub',
  '.csv',
];

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 10;

export function extensionOf(name = '') {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates newly added files against the current list. Returns the accepted
 * files plus human-readable rejection reasons — shared by the dropzone and the
 * unified composer so the rules can't drift.
 */
export function validateFiles(incoming, existing, options = {}) {
  const {
    accept = ACCEPTED_EXTENSIONS,
    maxBytes = MAX_FILE_BYTES,
    maxFiles = MAX_FILES,
  } = options;

  const rejections = [];
  const accepted = [];

  for (const file of incoming) {
    const ext = extensionOf(file.name);
    if (!accept.includes(ext)) {
      rejections.push(`${file.name}: unsupported type`);
    } else if (file.size > maxBytes) {
      rejections.push(`${file.name}: over ${formatSize(maxBytes)}`);
    } else if (existing.some((current) => current.name === file.name && current.size === file.size)) {
      rejections.push(`${file.name}: already added`);
    } else {
      accepted.push(file);
    }
  }

  const room = maxFiles - existing.length;
  const withinLimit = accepted.slice(0, Math.max(0, room));
  if (accepted.length > withinLimit.length) rejections.push(`Only ${maxFiles} files allowed at once`);

  return { accepted: withinLimit, rejections };
}
