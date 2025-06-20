import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, File, X, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  endpoint: string;
  accept?: string;
  maxSize?: number; // in bytes
  onUpload: (url: string) => void;
  placeholder?: string;
  description?: string;
  multiple?: boolean;
}

export default function FileUpload({
  endpoint,
  accept = "*/*",
  maxSize = 5 * 1024 * 1024, // 5MB default
  onUpload,
  placeholder = "Upload file or drag and drop",
  description = "Files up to 5MB",
  multiple = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      const fieldName = endpoint.includes('logo') ? 'logo' : endpoint.includes('watermark') ? 'watermark' : 'file';
      formData.append(fieldName, file);

      // Simulate upload progress
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        return result.url;
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: (url: string) => {
      setUploadedFile(url);
      onUpload(url);
      toast({
        title: "Upload successful",
        description: "Your file has been uploaded successfully",
      });
      setTimeout(() => setUploadProgress(0), 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
    }

    if (accept !== "*/*") {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileType = file.type;
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type;
        }
        if (type.includes('/*')) {
          return fileType.startsWith(type.replace('/*', ''));
        }
        return fileType === type;
      });

      if (!isAccepted) {
        return `File type not supported. Accepted types: ${accept}`;
      }
    }

    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0]; // Take first file only for now
    const error = validateFile(file);
    
    if (error) {
      toast({
        title: "Invalid file",
        description: error,
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setUploadedFile(null);
    onUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (uploadedFile) {
    return (
      <div className="upload-zone border-green-200 bg-green-50">
        <div className="text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
          <div className="mt-2">
            <p className="text-sm font-medium text-green-900">File uploaded successfully</p>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(uploadedFile, '_blank')}
              >
                View
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`upload-zone ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : uploadMutation.isPending 
            ? 'border-blue-300 bg-blue-50' 
            : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="text-center">
          {uploadMutation.isPending ? (
            <>
              <File className="mx-auto h-8 w-8 text-blue-600" />
              <div className="mt-2">
                <p className="text-sm font-medium text-blue-900">Uploading...</p>
                <Progress value={uploadProgress} className="w-full mt-2" />
              </div>
            </>
          ) : (
            <>
              <CloudUpload className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-2">
                <p className="text-sm font-medium text-foreground">{placeholder}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={uploadMutation.isPending}
      />
    </div>
  );
}
