import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { ConfigSchema } from './validation-schema';

@Injectable()
export class ImageUploadService {
  private s3: S3;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService<ConfigSchema>) {
    this.bucketName = this.configService.get('S3_BUCKET_NAME')!;

    this.s3 = new S3({
      endpoint: this.configService.get('S3_ENDPOINT'),
      accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('S3_SECRET_ACCESSKEY'),
      signatureVersion: 'v4',
    });
  }

  uploadFile(fileBuffer: Buffer, fileName: string, mimetype: string) {
    this.s3
      .upload({
        Bucket: this.bucketName,
        Body: fileBuffer,
        Key: fileName,
        ContentType: mimetype,
        ACL: 'public-read',
      })
      .promise()
      .catch((err) => {
        console.error(err);
      });
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: this.bucketName,
        Key: fileName,
      })
      .promise();
  }
}
