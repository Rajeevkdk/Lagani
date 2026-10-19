import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  ForbiddenException,
} from "@nestjs/common";
import { createConnection } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { AuthService, User, digest } from "./auth";
import { pool, query, tx, one } from "./db";
import { validate } from "./domain";
import { audit } from "./service";
import { storeBytes, readBytes } from "./storage";
export const controlledSample = Buffer.from(
  "LAGANI FICTIONAL SAMPLE\nNOT AN IDENTITY DOCUMENT\nBusiness: Invented demonstration SME\nRegistration: FICTIONAL-0000\nPAN: SAMPLE-ONLY\nController: Fictional Founder (100%)\nBank ownership: Not connected; human simulation review required.\nRevenue NPR 250000; variable cost NPR 125000; operating cost NPR 70000.\nNo real personal data. No executable content.\n",
  "utf8",
);
export function validateContent(name: string, mime: string, bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > 5242880)
    throw new BadRequestException("Upload must be between 1 byte and 5 MB.");
  if (
    !/\.(pdf|png|jpg|jpeg|txt)$/i.test(name) ||
    !["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(mime)
  )
    throw new BadRequestException(
      "Only PDF, PNG, JPEG and plain text fictional documents are accepted.",
    );
  const signatures: Record<string, boolean> = {
    "application/pdf": bytes.subarray(0, 5).toString() === "%PDF-",
    "image/png": bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    "text/plain":
      !bytes.includes(0) &&
      !/<script|<html|<!doctype/i.test(bytes.toString("utf8")),
  };
  if (!signatures[mime])
    throw new BadRequestException(
      "The document content does not match its declared file type.",
    );
}
export async function scan(bytes: Buffer): Promise<"clean" | "rejected"> {
  return new Promise((resolveScan, reject) => {
    const socket = createConnection({
      host: process.env.CLAMAV_HOST || "127.0.0.1",
      port: Number(process.env.CLAMAV_PORT || 3310),
    });
    let result = "";
    socket.setTimeout(12000, () =>
      socket.destroy(new Error("Scanner timeout")),
    );
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536),
          size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (d) => {
      result += d.toString();
    });
    socket.on("error", reject);
    socket.on("end", () => {
      if (result.includes("FOUND")) resolveScan("rejected");
      else if (result.includes("OK")) resolveScan("clean");
      else reject(new Error("Scanner returned no valid result"));
    });
  });
}
const storageDir = () =>
  resolve(process.env.DOCUMENT_DIRECTORY || ".local/documents");
@Injectable()
export class DocumentService {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  async upload(u: User, businessId: string, body: unknown, sample = false) {
    await this.auth.owner(u, businessId);
    const b = (
      await query("SELECT status FROM app.businesses WHERE id=$1", [businessId])
    )[0];
    if (!b || !["draft", "needs-information", "rejected"].includes(b.status))
      throw new BadRequestException(
        "Documents can be added while drafting or responding to information requests.",
      );
    const v = sample
      ? {
          name: "fictional-business-sample.txt",
          mimeType: "text/plain",
          contentBase64: controlledSample.toString("base64"),
        }
      : validate(
          z
            .object({
              name: z
                .string()
                .min(1)
                .max(100)
                .regex(/^[a-zA-Z0-9_. -]+$/),
              mimeType: z.string(),
              contentBase64: z.string().max(7000000),
              fictionalAcknowledged: z.literal(true),
            })
            .strict(),
          body,
        );
    const bytes = Buffer.from(v.contentBase64, "base64");
    validateContent(v.name, v.mimeType, bytes);
    const id = randomUUID(),
      storagePath = randomBytes(32).toString("hex");
    await storeBytes(storagePath, bytes, v.mimeType);
    let status = "quarantined";
    const document = await tx(async (c) => {
      await c.query("SELECT id FROM app.businesses WHERE id=$1 FOR UPDATE", [
        businessId,
      ]);
      const version = Number(
        (
          await one(
            c,
            "SELECT COALESCE(max(version),0)+1 AS version FROM app.documents WHERE business_id=$1 AND name=$2",
            [businessId, v.name],
          )
        ).version,
      );
      return one(
        c,
        "INSERT INTO app.documents(id,business_id,uploader_id,name,mime_type,size_bytes,version,storage_path,status,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'quarantined',$9) RETURNING *",
        [
          id,
          businessId,
          u.id,
          v.name,
          v.mimeType,
          bytes.length,
          version,
          storagePath,
          digest(bytes.toString("base64")),
        ],
      );
    });
    let engine = "ClamAV INSTREAM";
    if (sample) {
      if (!bytes.equals(controlledSample))
        throw new Error("Controlled sample integrity mismatch");
      status = "controlled-sample";
      engine = "Server-generated allowlisted plain text; no antivirus claim";
    } else {
      try {
        status = await scan(bytes);
      } catch {
        status = "scanner-unavailable";
      }
    }
    await query(
      "UPDATE app.documents SET status=$2,scan_engine=$3 WHERE id=$1",
      [id, status, engine],
    );
    await audit(pool, u.id, "document.upload", id, {
      businessId,
      status,
      version: document.version,
    });
    return {
      id,
      name: v.name,
      status,
      version: document.version,
      scanEngine: engine,
      message:
        status === "scanner-unavailable"
          ? "Stored in quarantine. Antivirus scanner is unavailable; review/download is blocked."
          : status === "controlled-sample"
            ? "Controlled fictional sample generated from fixed safe text. This is not an antivirus scan."
            : "Scanner completed.",
    };
  }
  async link(u: User, id: string) {
    const d = (await query("SELECT * FROM app.documents WHERE id=$1", [id]))[0];
    if (!d) throw new NotFoundException();
    await this.auth.documentAccess(u, d.business_id);
    if (!["clean", "controlled-sample"].includes(d.status))
      throw new ForbiddenException(
        "Document remains quarantined or was rejected.",
      );
    const token = randomBytes(32).toString("hex");
    await query(
      "INSERT INTO app.document_links(token_hash,document_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '2 minutes')",
      [digest(token), id, u.id],
    );
    await audit(pool, u.id, "document.link", id);
    return {
      url: `/api/documents/${id}/download?token=${token}`,
      expiresIn: 120,
    };
  }
  async download(u: User, id: string, token: string) {
    const d = (
      await query(
        "SELECT d.* FROM app.documents d JOIN app.document_links l ON l.document_id=d.id WHERE d.id=$1 AND l.token_hash=$2 AND l.user_id=$3 AND l.expires_at>now()",
        [id, digest(token || ""), u.id],
      )
    )[0];
    if (!d)
      throw new ForbiddenException(
        "The private document link is invalid or expired.",
      );
    await this.auth.documentAccess(u, d.business_id);
    if (!["clean", "controlled-sample"].includes(d.status))
      throw new ForbiddenException("Document is quarantined.");
    await audit(pool, u.id, "document.download", id);
    return {
      name: d.name,
      mime: d.mime_type,
      bytes: await readBytes(d.storage_path),
    };
  }
  async rescan(u: User, id: string) {
    this.auth.role(u, "admin", "superadmin");
    const d = (await query("SELECT * FROM app.documents WHERE id=$1", [id]))[0];
    if (!d) throw new NotFoundException();
    try {
      const status = await scan(await readBytes(d.storage_path));
      await query(
        "UPDATE app.documents SET status=$2,scan_engine='ClamAV INSTREAM' WHERE id=$1",
        [id, status],
      );
      return { status };
    } catch {
      throw new ServiceUnavailableException(
        "Antivirus scanner is unavailable. Document remains quarantined.",
      );
    }
  }
}
