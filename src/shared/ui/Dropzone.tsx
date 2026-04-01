import { useCallback } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

interface Props {
  onDrop: (files: File[]) => void;
  accept?: Accept;
  loading?: boolean;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function Dropzone({ onDrop, accept, loading, label = 'Déposer un fichier', compact, className }: Props) {
  const handleDrop = useCallback((files: File[]) => onDrop(files), [onDrop]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed border-[--border-color] rounded cursor-pointer hover:bg-gray-50 transition-colors text-center',
        isDragActive && 'bg-blue-50 border-blue-400',
        compact ? 'p-3' : 'p-8',
        className,
      )}
    >
      <input {...getInputProps()} />
      {loading ? (
        <Spinner className="w-5 h-5 mx-auto text-blue-600" />
      ) : (
        <>
          <Upload className={cn('mx-auto text-gray-400 mb-2', compact ? 'w-4 h-4' : 'w-6 h-6')} />
          <p className="text-xs font-medium text-gray-600">{label}</p>
        </>
      )}
    </div>
  );
}
