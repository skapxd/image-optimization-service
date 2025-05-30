import { Injectable, Logger } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { ConfigSchema } from './validation-schema';
import { ClientContextService } from 'src/client-context/client-context.service';

@Injectable()
export class ImageUploadService {
  private s3: S3;
  private readonly bucketName: string;

  private readonly logger = new Logger(ImageUploadService.name); // Logger servic

  constructor(
    private readonly clientContext: ClientContextService,
    private readonly configService: ConfigService<ConfigSchema>,
  ) {
    this.bucketName = this.configService.get('S3_BUCKET_NAME')!;

    this.s3 = new S3({
      endpoint: this.configService.get('S3_ENDPOINT'),
      accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('S3_SECRET_ACCESSKEY'),
      signatureVersion: 'v4',
    });
  }

  async uploadFile(
    fileBuffer: Buffer,
    optimizationId: string,
    mimetype: string,
  ) {
    const context =
      this.clientContext.getControllerParamsContext(optimizationId);

    if (!context) {
      this.logger.error(`Context not found id: ${optimizationId}`);

      return;
    }

    await this.s3
      .upload({
        Bucket: this.bucketName,
        Body: fileBuffer,
        Key: context.newFilePath,
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
