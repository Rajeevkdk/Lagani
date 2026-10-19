import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
const directory = () =>
  resolve(process.env.DOCUMENT_DIRECTORY || ".local/documents");
const bucket = () =>
  process.env.SUPABASE_DOCUMENT_BUCKET || "fictional-documents";
const remote = () => process.env.AUTH_MODE === "supabase";
function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Private Supabase storage is not configured.");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function storeBytes(path: string, bytes: Buffer, mime: string) {
  if (remote()) {
    const { error } = await client()
      .storage.from(bucket())
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
  } else {
    await mkdir(directory(), { recursive: true });
    await writeFile(resolve(directory(), path), bytes, { flag: "wx" });
  }
}
export async function readBytes(path: string) {
  if (remote()) {
    const { data, error } = await client()
      .storage.from(bucket())
      .download(path);
    if (error || !data) throw error || new Error("Document unavailable");
    return Buffer.from(await data.arrayBuffer());
  }
  return readFile(resolve(directory(), path));
}
export async function removeBytes(path: string) {
  if (remote()) {
    const { error } = await client().storage.from(bucket()).remove([path]);
    if (error) throw error;
  } else {
    try {
      await unlink(resolve(directory(), path));
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
