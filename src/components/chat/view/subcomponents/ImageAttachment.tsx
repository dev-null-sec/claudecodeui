import { useEffect, useState } from 'react';
import { ImageIcon, XIcon } from 'lucide-react';

import type { ImagePathAttachment } from '../../types/types';

interface ImageAttachmentProps {
  attachment: ImagePathAttachment;
  onRemove: () => void;
  uploadProgress?: number;
  error?: string;
}

const ImageAttachment = ({ attachment, onRemove, uploadProgress, error }: ImageAttachmentProps) => {
  const [preview, setPreview] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (!attachment.file) {
      setPreview(undefined);
      return;
    }

    const url = URL.createObjectURL(attachment.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.file]);
  
  return (
    <div className="group relative" title={attachment.path}>
      {preview ? (
        <img src={preview} alt={attachment.name} className="h-20 w-20 rounded object-cover" />
      ) : (
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded border border-border/60 bg-background px-2 text-muted-foreground">
          <ImageIcon className="mb-1 h-5 w-5" />
          <div className="line-clamp-2 max-w-full break-all text-center text-[10px] leading-3">
            {attachment.name}
          </div>
        </div>
      )}
      {uploadProgress !== undefined && uploadProgress < 100 && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
          <div className="text-xs text-white">{uploadProgress}%</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-red-500/50">
          <XIcon className="h-6 w-6 text-white" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Remove image"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
};

export default ImageAttachment;


