import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionOrTelegramGuard } from '../common/guards/session-or-telegram.guard';
import { AnalyzeService } from './analyze.service';

@Controller('api/analyze')
@UseGuards(SessionOrTelegramGuard)
export class AnalyzeController {
  constructor(private readonly analyze: AnalyzeService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async analyzeFood(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { text?: string; caption?: string; imageBase64?: string; mimeType?: string }
  ) {
    try {
      if (file?.buffer) {
        return { ...await this.analyze.analyzeFoodPhoto(file.buffer, file.mimetype, body.caption || ''), source: 'PHOTO_ESTIMATE' };
      }
      if (body.imageBase64) {
        const buffer = Buffer.from(body.imageBase64, 'base64');
        return { ...await this.analyze.analyzeFoodPhoto(buffer, body.mimeType || 'image/jpeg', body.caption || ''), source: 'PHOTO_ESTIMATE' };
      }
      if (body.text) {
        return { ...await this.analyze.analyzeFoodText(body.text), source: 'TEXT_ESTIMATE' };
      }
      throw new BadRequestException('Provide an image or a food description');
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
