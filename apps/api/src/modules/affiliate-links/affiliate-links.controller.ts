import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { parseDto } from '../../common/parse-dto';
import { CreateAffiliateLinkDto } from './affiliate-link.dto';
import { AffiliateLinksService } from './affiliate-links.service';

@Controller('affiliate-links')
export class AffiliateLinksController {
  constructor(@Inject(AffiliateLinksService) private readonly service: AffiliateLinksService) {}

  // 200 tanto para link novo quanto reaproveitado: a diferença vem em meta.reused.
  @Post()
  @HttpCode(200)
  async create(@Body() rawBody: unknown) {
    return this.service.create(await parseDto(CreateAffiliateLinkDto, rawBody, false));
  }
}
