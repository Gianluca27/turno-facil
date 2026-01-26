import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

export type BucketType = 'avatars' | 'businessMedia' | 'reviews' | 'receipts';

export interface UploadParams {
  bucket: BucketType;
  file: Buffer;
  fileName: string;
  contentType: string;
  folder?: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlParams {
  bucket: BucketType;
  key: string;
  expiresIn?: number;
  contentType?: string;
}

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

class S3Service {
  private client: S3Client | null = null;
  private initialized: boolean = false;
  private buckets: Record<BucketType, string>;
  private cloudfrontDomain: string | undefined;

  constructor() {
    this.buckets = {
      avatars: config.aws.s3.bucketAvatars,
      businessMedia: config.aws.s3.bucketBusinessMedia,
      reviews: config.aws.s3.bucketReviews,
      receipts: config.aws.s3.bucketReceipts,
    };
    this.cloudfrontDomain = config.aws.cloudfront.domain;
    this.initialize();
  }

  private initialize(): void {
    const { accessKeyId, secretAccessKey, region } = config.aws;

    if (accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.initialized = true;
      logger.info('S3 service initialized successfully');
    } else {
      logger.warn('AWS credentials not configured. S3 features will be unavailable.');
    }
  }

  isConfigured(): boolean {
    return this.initialized && this.client !== null;
  }

  private getBucketName(bucket: BucketType): string {
    return this.buckets[bucket];
  }

  private generateKey(folder: string | undefined, fileName: string): string {
    const uniqueId = uuidv4();
    const extension = fileName.split('.').pop() || '';
    const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
    const key = `${uniqueId}-${baseName}.${extension}`;

    return folder ? `${folder}/${key}` : key;
  }

  getPublicUrl(bucket: BucketType, key: string): string {
    if (this.cloudfrontDomain) {
      return `https://${this.cloudfrontDomain}/${key}`;
    }
    return `https://${this.getBucketName(bucket)}.s3.amazonaws.com/${key}`;
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    if (!this.isConfigured()) {
      logger.warn('S3 not configured. File upload skipped.');
      return { success: false, error: 'Storage service not configured' };
    }

    try {
      const bucketName = this.getBucketName(params.bucket);
      const key = this.generateKey(params.folder, params.fileName);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: params.file,
        ContentType: params.contentType,
        Metadata: params.metadata,
        CacheControl: 'max-age=31536000',
      });

      await this.client!.send(command);

      const url = this.getPublicUrl(params.bucket, key);

      logger.info('File uploaded successfully', {
        bucket: bucketName,
        key,
        contentType: params.contentType,
        size: params.file.length,
      });

      return { success: true, key, url };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upload file', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async uploadImage(params: UploadParams, options?: ImageProcessingOptions): Promise<UploadResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Storage service not configured' };
    }

    try {
      let processedImage = sharp(params.file);
      const metadata = await processedImage.metadata();

      if (options?.width || options?.height) {
        processedImage = processedImage.resize({
          width: options.width,
          height: options.height,
          fit: options.fit || 'cover',
          withoutEnlargement: true,
        });
      }

      const format = options?.format || 'webp';
      const quality = options?.quality || 80;

      if (format === 'jpeg') {
        processedImage = processedImage.jpeg({ quality, progressive: true });
      } else if (format === 'png') {
        processedImage = processedImage.png({ compressionLevel: 9 });
      } else {
        processedImage = processedImage.webp({ quality });
      }

      const processedBuffer = await processedImage.toBuffer();

      const extension = format === 'jpeg' ? 'jpg' : format;
      const newFileName = params.fileName.replace(/\.[^/.]+$/, `.${extension}`);

      const result = await this.upload({
        ...params,
        file: processedBuffer,
        fileName: newFileName,
        contentType: `image/${format}`,
      });

      if (!result.success) {
        return result;
      }

      let thumbnailResult: { key?: string; url?: string } = {};
      if (metadata.width && metadata.width > 400) {
        const thumbnailBuffer = await sharp(params.file)
          .resize({ width: 200, height: 200, fit: 'cover' })
          .webp({ quality: 70 })
          .toBuffer();

        const thumbFileName = `thumb_${newFileName.replace(/\.[^/.]+$/, '.webp')}`;
        const thumbUpload = await this.upload({
          ...params,
          file: thumbnailBuffer,
          fileName: thumbFileName,
          contentType: 'image/webp',
          folder: params.folder ? `${params.folder}/thumbnails` : 'thumbnails',
        });

        if (thumbUpload.success) {
          thumbnailResult = {
            key: thumbUpload.key,
            url: thumbUpload.url,
          };
        }
      }

      return {
        ...result,
        thumbnailKey: thumbnailResult.key,
        thumbnailUrl: thumbnailResult.url,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upload image', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async delete(bucket: BucketType, key: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Storage service not configured' };
    }

    try {
      const bucketName = this.getBucketName(bucket);

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.client!.send(command);

      logger.info('File deleted successfully', { bucket: bucketName, key });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete file', { error: errorMessage, bucket, key });
      return { success: false, error: errorMessage };
    }
  }

  async getSignedUploadUrl(params: SignedUrlParams): Promise<SignedUrlResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Storage service not configured' };
    }

    try {
      const bucketName = this.getBucketName(params.bucket);
      const expiresIn = params.expiresIn || 3600;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: params.key,
        ContentType: params.contentType,
      });

      const url = await getSignedUrl(this.client!, command, { expiresIn });

      logger.info('Generated signed upload URL', {
        bucket: bucketName,
        key: params.key,
        expiresIn,
      });

      return { success: true, url };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate signed upload URL', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async getSignedDownloadUrl(params: SignedUrlParams): Promise<SignedUrlResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Storage service not configured' };
    }

    try {
      const bucketName = this.getBucketName(params.bucket);
      const expiresIn = params.expiresIn || 3600;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: params.key,
      });

      const url = await getSignedUrl(this.client!, command, { expiresIn });

      return { success: true, url };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate signed download URL', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async copy(
    sourceBucket: BucketType,
    sourceKey: string,
    destBucket: BucketType,
    destKey: string
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Storage service not configured' };
    }

    try {
      const sourceBucketName = this.getBucketName(sourceBucket);
      const destBucketName = this.getBucketName(destBucket);

      const command = new CopyObjectCommand({
        Bucket: destBucketName,
        Key: destKey,
        CopySource: `${sourceBucketName}/${sourceKey}`,
      });

      await this.client!.send(command);

      const url = this.getPublicUrl(destBucket, destKey);

      logger.info('File copied successfully', {
        from: `${sourceBucketName}/${sourceKey}`,
        to: `${destBucketName}/${destKey}`,
      });

      return { success: true, key: destKey, url };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to copy file', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async exists(bucket: BucketType, key: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const bucketName = this.getBucketName(bucket);

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.client!.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  generateUploadKey(_bucket: BucketType, folder: string, extension: string): string {
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    return `${folder}/${timestamp}-${uniqueId}.${extension}`;
  }
}

export const s3Service = new S3Service();
