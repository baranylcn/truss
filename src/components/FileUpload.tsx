import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, X } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  uploadedFile?: File | null;
  onRemoveFile?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, uploadedFile, onRemoveFile }) => {
  const { t } = useLanguage();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  if (uploadedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 border border-gray-700 rounded-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-white font-medium">{uploadedFile.name}</div>
              <div className="text-gray-400 text-sm">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
          {onRemoveFile && (
            <motion.button
              onClick={onRemoveFile}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? 'border-cyan-400 bg-cyan-400/10'
          : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <input {...getInputProps()} />
      <motion.div
        animate={{
          y: isDragActive ? -5 : 0,
          scale: isDragActive ? 1.1 : 1
        }}
        className="flex flex-col items-center gap-4"
      >
        <div className={`p-4 rounded-full ${
          isDragActive ? 'bg-cyan-400/20' : 'bg-gray-700'
        }`}>
          <Upload className={`w-8 h-8 ${
            isDragActive ? 'text-cyan-400' : 'text-gray-400'
          }`} />
        </div>
        <div>
          <div className="text-white font-medium mb-2">
            {isDragActive ? 'Drop your file here' : 'Upload your dataset'}
          </div>
          <div className="text-gray-400 text-sm">
            Supports CSV, XLSX files up to 100MB
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};