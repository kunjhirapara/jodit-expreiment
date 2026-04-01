"use client";

import { useState } from "react";
import Editor from "@/components/Editor";

export default function Home() {
  const [content, setContent] = useState<string>("");

  return <Editor value={content} onChange={setContent} />
}
