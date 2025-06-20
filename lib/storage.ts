import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// 原本仅支持AWS S3，现在支持其他存储服务 先尝试接入腾讯云COS
interface StorageConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export function newStorage(config?: StorageConfig) {
  return new Storage(config);
}

export class Storage {
  private s3: S3Client;

  constructor(config?: StorageConfig) {
    const endpoint = config?.endpoint || process.env.STORAGE_ENDPOINT || "";
    const accessKey = config?.accessKey || process.env.STORAGE_ACCESS_KEY || "";
    const secretKey = config?.secretKey || process.env.STORAGE_SECRET_KEY || "";
    const region = config?.region || process.env.STORAGE_REGION || "auto";

    // 验证必需的配置参数
    if (!endpoint) {
      throw new Error("Storage endpoint is required. Please set STORAGE_ENDPOINT environment variable.");
    }
    if (!accessKey) {
      throw new Error("Storage access key is required. Please set STORAGE_ACCESS_KEY environment variable.");
    }
    if (!secretKey) {
      throw new Error("Storage secret key is required. Please set STORAGE_SECRET_KEY environment variable.");
    }

    // 验证endpoint是否为有效URL
    try {
      new URL(endpoint);
    } catch (error) {
      throw new Error(`Invalid storage endpoint URL: ${endpoint}`);
    }

    // 检查存储服务类型
    const isTencentCOS = endpoint.includes('cos.') || endpoint.includes('myqcloud.com');
    const isCloudflareR2 = endpoint.includes('r2.cloudflarestorage.com');

    this.s3 = new S3Client({
      endpoint: endpoint,
      region: region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      // Cloudflare R2 和腾讯云COS需要禁用路径样式
      forcePathStyle: !isTencentCOS && !isCloudflareR2,
    });
  }

  async uploadFile({
    body,
    key,
    contentType,
    bucket,
    onProgress,
    disposition = "inline",
  }: {
    body: Buffer;
    key: string;
    contentType?: string;
    bucket?: string;
    onProgress?: (progress: number) => void;
    disposition?: "inline" | "attachment";
  }) {
    if (!bucket) {
      bucket = process.env.STORAGE_BUCKET || "";
    }

    if (!bucket) {
      throw new Error("Bucket is required. Please set STORAGE_BUCKET environment variable.");
    }

    // 验证上传参数
    if (!key || key.trim().length === 0) {
      throw new Error("File key cannot be empty");
    }
    if (!body || body.length === 0) {
      throw new Error("File body cannot be empty");
    }

    try {
      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentDisposition: disposition,
          ...(contentType && { ContentType: contentType }),
        },
      });

      if (onProgress) {
        upload.on("httpUploadProgress", (progress) => {
          const percentage =
            ((progress.loaded || 0) / (progress.total || 1)) * 100;
          onProgress(percentage);
        });
      }

      const res = await upload.done();

      if (!res.Key) {
        throw new Error("Upload completed but no key returned");
      }

      // 构建公共访问URL
      let publicUrl = res.Location;

      // 优先使用STORAGE_PUBLIC_URL（Cloudflare R2公共域名）
      if (process.env.STORAGE_PUBLIC_URL && res.Key) {
        // 确保公共URL格式正确
        const baseUrl = process.env.STORAGE_PUBLIC_URL.replace(/\/$/, '');
        publicUrl = `${baseUrl}/${res.Key}`;
      }
      // 备用：使用STORAGE_DOMAIN（腾讯云COS等）
      else if (process.env.STORAGE_DOMAIN && res.Key) {
        const baseUrl = process.env.STORAGE_DOMAIN.replace(/\/$/, '');
        publicUrl = `${baseUrl}/${res.Key}`;
      }

      // 验证生成的URL是否有效
      if (!publicUrl) {
        throw new Error("Failed to generate public URL for uploaded file");
      }

      return {
        location: res.Location,
        bucket: res.Bucket,
        key: res.Key,
        filename: res.Key.split("/").pop(),
        url: publicUrl,
      };
    } catch (error) {
      // 提供更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('NoSuchBucket')) {
          throw new Error(`Storage bucket '${bucket}' does not exist`);
        }
        if (error.message.includes('AccessDenied')) {
          throw new Error('Storage access denied. Please check credentials and permissions');
        }
        if (error.message.includes('NetworkingError') || error.message.includes('timeout')) {
          throw new Error('Network error occurred while uploading to storage');
        }
      }
      throw error;
    }
  }

  async downloadAndUpload({
    url,
    key,
    bucket,
    contentType,
    disposition = "inline",
  }: {
    url: string;
    key: string;
    bucket?: string;
    contentType?: string;
    disposition?: "inline" | "attachment";
  }) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No body in response");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return this.uploadFile({
      body: buffer,
      key,
      bucket,
      contentType,
      disposition,
    });
  }
}
