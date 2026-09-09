/**
 * S3 Service for Media Upload – Pre-Signed URLs (Epic 8)
 */

import crypto from "node:crypto";
import type { FastifyBaseLogger } from "fastify";

interface S3Config {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
}

interface PresignedUrlResult {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

export class S3Service {
  private config: S3Config;
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ module: "S3Service" });
    this.config = {
      bucket: process.env["S3_BUCKET"] ?? "via-romae-media",
      region: process.env["S3_REGION"] ?? "eu-central-1",
      endpoint: process.env["S3_ENDPOINT"],
      accessKeyId: process.env["S3_ACCESS_KEY_ID"] ?? "",
      secretAccessKey: process.env["S3_SECRET_ACCESS_KEY"] ?? "",
    };

    if (!this.config.accessKeyId || !this.config.secretAccessKey) {
      this.logger.warn("S3 credentials not configured – uploads will fail");
    }
  }

  /**
   * Generate a pre-signed URL for direct client upload to S3.
   * Uses AWS Signature Version 4 (manual implementation to avoid AWS SDK dependency).
   */
  async generatePresignedUploadUrl(
    teamId: string,
    questRunId: string,
    fileType: string,
    fileSizeBytes: number,
  ): Promise<PresignedUrlResult> {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = timestamp.slice(0, 8);
    const fileExt = this.getFileExtension(fileType);
    const uniqueId = crypto.randomBytes(16).toString("hex");
    
    // Object key: team/{teamId}/quest/{questRunId}/{timestamp}_{uniqueId}.{ext}
    const objectKey = `team/${teamId}/quest/${questRunId}/${timestamp}_${uniqueId}.${fileExt}`;
    
    const expiresIn = 3600; // 1 hour
    const host = this.config.endpoint
      ? new URL(this.config.endpoint).host
      : `${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
    
    const credential = `${this.config.accessKeyId}/${date}/${this.config.region}/s3/aws4_request`;
    const algorithm = "AWS4-HMAC-SHA256";
    
    // Build canonical request for PUT
    const canonicalRequest = [
      "PUT",
      `/${objectKey}`,
      this.buildQueryString({
        "X-Amz-Algorithm": algorithm,
        "X-Amz-Credential": credential,
        "X-Amz-Date": timestamp,
        "X-Amz-Expires": expiresIn.toString(),
        "X-Amz-SignedHeaders": "content-type;host",
      }),
      `content-type:${fileType}\nhost:${host}`,
      "content-type;host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    // String to sign
    const stringToSign = [
      algorithm,
      timestamp,
      `${date}/${this.config.region}/s3/aws4_request`,
      this.sha256(canonicalRequest),
    ].join("\n");

    // Calculate signature
    const signature = this.calculateSignature(
      this.config.secretAccessKey,
      date,
      this.config.region,
      "s3",
      stringToSign,
    );

    // Build final URL
    const protocol = this.config.endpoint ? new URL(this.config.endpoint).protocol : "https:";
    const uploadUrl = `${protocol}//${host}/${objectKey}?${this.buildQueryString({
      "X-Amz-Algorithm": algorithm,
      "X-Amz-Credential": credential,
      "X-Amz-Date": timestamp,
      "X-Amz-Expires": expiresIn.toString(),
      "X-Amz-SignedHeaders": "content-type;host",
      "X-Amz-Signature": signature,
    })}`;

    this.logger.info(
      { objectKey, fileType, fileSizeBytes },
      "Generated pre-signed upload URL",
    );

    return { uploadUrl, objectKey, expiresIn };
  }

  /**
   * Validate uploaded object exists (optional – for webhook verification).
   */
  async validateObjectExists(objectKey: string): Promise<boolean> {
    // TODO: Implement HEAD request to S3 if needed
    // For now, we trust the upload webhook or S3 event notification
    this.logger.debug({ objectKey }, "Skipping object existence validation");
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getFileExtension(mimeType: string): string {
    const map: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
    };
    return map[mimeType] ?? "bin";
  }

  private buildQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key]!)}`)
      .join("&");
  }

  private sha256(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
  }

  private hmac(key: string | Buffer, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
  }

  private calculateSignature(
    secretKey: string,
    date: string,
    region: string,
    service: string,
    stringToSign: string,
  ): string {
    const kDate = this.hmac(`AWS4${secretKey}`, date);
    const kRegion = this.hmac(kDate, region);
    const kService = this.hmac(kRegion, service);
    const kSigning = this.hmac(kService, "aws4_request");
    return this.hmac(kSigning, stringToSign).toString("hex");
  }
}
