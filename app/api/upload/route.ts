import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Jodit sends files under "files[0]", "files[1]", etc.
    const uploadedFiles: string[] = [];
    const isImages: boolean[] = [];

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const file = value;

        // Validate it's an image
        if (!file.type.startsWith("image/")) {
          continue;
        }

        // Generate a unique filename
        const safeName = file.name;

        // Ensure upload directory exists
        const uploadDir = path.join(
          process.cwd(),
          "public",
          "images",
          "editor-images",
        );
        await fs.mkdir(uploadDir, { recursive: true });

        // Write file to disk
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadDir, safeName);
        await fs.writeFile(filePath, buffer);

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
