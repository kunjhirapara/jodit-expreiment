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

/**
 * Calls the /api/delete endpoint to remove an image file from the server.
 * Returns true if deletion was successful, false otherwise.
 */
async function deleteImageFromServer(src: string): Promise<boolean> {
  try {
    const response = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src }),
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error("Failed to delete image from server:", error);
    return false;
  }
}

/**
 * Checks if a URL points to our editor-images directory (i.e., an uploaded image).
 */
function isEditorImage(src: string): boolean {
  if (!src) return false;
  try {
    // Handle both absolute URLs and relative paths
    const pathname = src.startsWith("http")
      ? new URL(src).pathname
      : src;
    return pathname.startsWith("/images/editor-images/");
  } catch {
    return false;
  }
}

export default function Editor({ value = "", onChange }: EditorProps) {
  const editor = useRef<IJodit | null>(null);
  const joditInstance = useRef<IJodit | null>(null);

  // Capture the Jodit instance when it's ready
  const handleEditorRef = useCallback((instance: IJodit) => {
    joditInstance.current = instance;

    // --- Keyboard Delete/Backspace handler ---
    // When the user presses Delete or Backspace while an image is selected,
    // we intercept the event, delete the image from the server, then remove the element.
    instance.events.on(
      "keydown",
      (event: KeyboardEvent) => {
        if (event.key !== "Delete" && event.key !== "Backspace") return;

        const selection = instance.selection;
        if (!selection) return;

        // Check if an image is currently selected (Jodit wraps selected images)
        const selectedNode = selection.current();
        if (!selectedNode) return;

        // Find the image element – could be the node itself or its parent
        let imgElement: HTMLImageElement | null = null;

        if (
          selectedNode.nodeType === Node.ELEMENT_NODE &&
          (selectedNode as HTMLElement).tagName === "IMG"
        ) {
          imgElement = selectedNode as HTMLImageElement;
        } else if (
          selectedNode.parentElement &&
          selectedNode.parentElement.tagName === "IMG"
        ) {
          imgElement = selectedNode.parentElement as HTMLImageElement;
        } else {
          // Also check if the selection is inside a wrapper that contains an img
          const closest =
            selectedNode.nodeType === Node.ELEMENT_NODE
              ? (selectedNode as HTMLElement).querySelector("img")
              : null;
          if (closest) {
            imgElement = closest;
          }
        }

        if (!imgElement) return;

        const src = imgElement.getAttribute("src");
        if (!src || !isEditorImage(src)) return;

        // Prevent default delete behavior – we handle it ourselves
        event.preventDefault();
        event.stopPropagation();

        // Delete from server, then remove the DOM element
        deleteImageFromServer(src).then((success) => {
          if (success) {
            console.log("Image deleted from server:", src);
          } else {
            console.warn(
              "Server deletion failed but removing from editor:",
              src,
            );
          }
          // Remove the image from the editor regardless
          imgElement!.remove();
          // Trigger change so React state stays in sync
          if (onChange) {
            onChange(instance.value);
          }
        });
      },
      undefined,
      true, // Run before other handlers
    );

    // --- afterCommand handler for the toolbar/popup "Delete" action ---
    // Jodit fires 'afterCommand' with command name when a toolbar action is used.
    // We intercept 'delete' commands and check if an image was just removed.
    instance.events.on(
      "afterCommand",
      (command: string) => {
        // Not relevant commands
        if (command !== "delete" && command !== "remove") return;
      },
    );
  }, [onChange]);

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

      // Events – use beforeRemoveNode to intercept image deletion from
      // Jodit's built-in popup delete button and other removal paths
      events: {
        // This fires BEFORE any node is removed from the editor DOM.
        // Jodit's popup "Delete" button triggers a DOM removal which we can intercept here.
        afterInit: (jodit: IJodit) => {
          // Use a MutationObserver to detect when images are removed from the editor
          const editorArea = jodit.editor;
          if (!editorArea) return;

          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              for (const removedNode of Array.from(mutation.removedNodes)) {
                // Check if removed node is an image
                if (
                  removedNode.nodeType === Node.ELEMENT_NODE &&
                  (removedNode as HTMLElement).tagName === "IMG"
                ) {
                  const src = (removedNode as HTMLImageElement).getAttribute(
                    "src",
                  );
                  if (src && isEditorImage(src)) {
                    deleteImageFromServer(src).then((success) => {
                      if (success) {
                        console.log("Image deleted from server (observer):", src);
                      }
                    });
                  }
                }

                // Check if removed node contains images (e.g., a wrapper div)
                if (removedNode.nodeType === Node.ELEMENT_NODE) {
                  const imgs = (removedNode as HTMLElement).querySelectorAll?.(
                    "img",
                  );
                  if (imgs) {
                    imgs.forEach((img) => {
                      const src = img.getAttribute("src");
                      if (src && isEditorImage(src)) {
                        deleteImageFromServer(src).then((success) => {
                          if (success) {
                            console.log(
                              "Image deleted from server (observer/nested):",
                              src,
                            );
                          }
                        });
                      }
                    });
                  }
                }
              }
            }
          });

          observer.observe(editorArea, {
            childList: true,
            subtree: true,
          });

          // Clean up observer when editor is destroyed
          jodit.events.on("beforeDestruct", () => {
            observer.disconnect();
          });
        },
      },
    }),
    [onChange],
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
