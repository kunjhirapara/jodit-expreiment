import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { src } = body as { src?: string };

    if (!src || typeof src !== "string") {
      return NextResponse.json(
        { success: false, message: "Missing or invalid 'src' parameter" },
        { status: 400 },
      );
    }

    // Extract the filename from the src URL
    // src can be "/images/editor-images/filename.jpg" or a full URL
    const parsed = src.startsWith("http")
      ? new URL(src).pathname
      : src;

    // Ensure the path is within the allowed editor-images directory
    const normalizedPath = path.normalize(parsed);
    if (!normalizedPath.startsWith("/images/editor-images/")) {
      return NextResponse.json(
        { success: false, message: "Invalid image path" },
        { status: 403 },
      );
    }

    // Build the absolute file path
    const filePath = path.join(process.cwd(), "public", normalizedPath);

    // Resolve to prevent directory traversal attacks
    const resolvedPath = path.resolve(filePath);
    const allowedDir = path.resolve(
      process.cwd(),
      "public",
      "images",
      "editor-images",
    );

    if (!resolvedPath.startsWith(allowedDir)) {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 },
      );
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 },
      );
    }

    // Delete the file
    await fs.unlink(resolvedPath);

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete image" },
      { status: 500 },
    );
  }
}
