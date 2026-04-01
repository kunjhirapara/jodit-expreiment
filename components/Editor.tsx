"use client";

import { useRef, useMemo, useCallback, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { IJodit } from "jodit/esm/types/jodit";
import type { Config } from "jodit/esm/config";
import type { DeepPartial } from "jodit/esm/types";

// Dynamically import JoditEditor to avoid SSR issues (Jodit needs DOM)
const JoditEditor = dynamic(() => import("jodit-react"), {
  ssr: false,
  loading: () => (
    <div className="editor-skeleton">
      <div className="skeleton-toolbar" />
      <div className="skeleton-body" />
    </div>
  ),
});

// Matches the shape returned by our /api/upload endpoint
interface UploadApiResponse {
  success: boolean;
  time: string;
  data: {
    files: string[];
    path: string;
    baseurl: string;
    isImages: boolean[];
    messages?: string[];
  };
}

// Matches Jodit's IUploaderData shape
interface UploaderData {
  files: string[];
  path: string;
  baseurl: string;
  isImages: boolean[];
}

interface EditorProps {
  value?: string;
  onChange?: (content: string) => void;
}

export default function Editor({ value = "", onChange }: EditorProps) {
  const editor = useRef<IJodit | null>(null);
  const joditInstance = useRef<IJodit | null>(null);

  // Capture the Jodit instance when it's ready
  const handleEditorRef = useCallback((instance: IJodit) => {
    joditInstance.current = instance;
  }, []);

  const config: DeepPartial<Config> = useMemo(
    () => ({
      readonly: false,
      height: 500,
      toolbarSticky: true,
      toolbarAdaptive: true,

      // Image upload configuration
      uploader: {
        url: "/api/upload",
        format: "json",
        method: "POST",

        // Jodit sends files with this variable name pattern
        // filesVariableName: "file",

        // Validate the server response
        isSuccess(resp: UploadApiResponse): boolean {
          return resp.success;
        },

        // Extract error message from response
        getMessage(resp: UploadApiResponse): string {
          return resp.data?.messages?.join("\n") || "Upload failed";
        },

        // Transform server response into Jodit's expected data format
        process(resp: UploadApiResponse): UploaderData {
          return {
            files: resp.data.files || [],
            path: resp.data.path || "",
            baseurl: resp.data.baseurl || "",
            isImages: resp.data.isImages || [],
          };
        },

        // After successful upload, insert images into the editor
        defaultHandlerSuccess(data: UploaderData): void {
          const j = joditInstance.current;
          if (j && data.files && data.files.length) {
            for (let i = 0; i < data.files.length; i++) {
              const fullUrl = data.baseurl + data.files[i];
              j.selection.insertImage(fullUrl, null, 600);
            }
          }
        },

        defaultHandlerError(e: Error): void {
          const j = joditInstance.current;
          if (j) {
            j.events.fire("errorMessage", e.message, "error", 4000);
          }
        },
      },

      // Enable drag-and-drop and paste images
      enableDragAndDropFileToEditor: true,

      // Image settings
      imageDefaultWidth: 600,

      // Buttons configuration
      buttons: [
        "source",
        "|",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "|",
        "ul",
        "ol",
        "|",
        "font",
        "fontsize",
        "brush",
        "paragraph",
        "|",
        "image",
        "video",
        "table",
        "link",
        "|",
        "align",
        "|",
        "undo",
        "redo",
        "|",
        "hr",
        "eraser",
        "copyformat",
        "|",
        "fullsize",
        "print",
      ],

      // Show placeholder text
      placeholder: "Start typing your content here...",

      // Allow resizing images
      allowResizeX: true,
      allowResizeY: true,

      // Allow paste images from clipboard
      askBeforePasteFromWord: false,
      askBeforePasteHTML: false,
    }),
    [],
  );

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="editor-skeleton">
        <div className="skeleton-toolbar" />
        <div className="skeleton-body" />
      </div>
    );
  }

  return (
    <JoditEditor
      ref={editor}
      value={value}
      config={config}
      editorRef={handleEditorRef}
      onBlur={(newContent: string) => {
        if (onChange) onChange(newContent);
      }}
    />
  );
}
