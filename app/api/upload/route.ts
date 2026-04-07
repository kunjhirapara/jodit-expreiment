import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  // Track written files so we can clean up on failure
  const writtenFilePaths: string[] = [];

  try {
    const formData = await request.formData();

    // Jodit sends files under "files[0]", "files[1]", etc.
    const uploadedFiles: string[] = [];
    const isImages: boolean[] = [];

    // Ensure upload directory exists
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "images",
      "editor-images",
    );
    await fs.mkdir(uploadDir, { recursive: true });

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const file = value;

        // Validate it's an image
        if (!file.type.startsWith("image/")) {
          continue;
        }

        // Generate a unique filename
        const safeName = file.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-\.]/g, "")
          .replace(/-+/g, "-")
          .replace(/^(.*)\.(png|webp|jpg|jpeg|gif)$/, (_, name, ext) => {
            return name.replace(/\./g, "-") + "." + ext;
          });

        // Write file to disk
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadDir, safeName);
        await fs.writeFile(filePath, buffer);

        // Track the written file for potential cleanup
        writtenFilePaths.push(filePath);
        uploadedFiles.push(safeName);
        isImages.push(true);
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          time: new Date().toISOString(),
          data: { messages: ["No valid image files received"] },
        },
        { status: 400 },
      );
    }

    // Return in the format Jodit's uploader expects:
    // { success: true, data: { files: [...], baseurl: "...", isImages: [...] } }
    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      data: {
        files: uploadedFiles,
        path: "",
        baseurl: "/images/editor-images/",
        isImages,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);

    // Clean up any files that were already written before the failure
    for (const filePath of writtenFilePaths) {
      try {
        await fs.unlink(filePath);
        console.log("Cleaned up partial upload:", filePath);
      } catch {
        // Ignore cleanup errors – file may not have been written yet
      }
    }

    return NextResponse.json(
      {
        success: false,
        time: new Date().toISOString(),
        data: { messages: ["Upload failed"] },
      },
      { status: 500 },
    );
  }
}
