import { Injectable } from '@nestjs/common';
import { OfferProvider, OfferSearch, OfferSearchResponse, Offer } from './offer-provider';
const FIXTURES: Offer[] = [
  { marketplace:'SHOPEE',shopId:'456',itemId:'123',name:'Organizador de cozinha (DADO FICTÍCIO)',productUrl:'https://shopee.com.br/product/456/123',price:'59.90',commissionRate:'0.080000',rating:'4.8' },
  { marketplace:'SHOPEE',shopId:'456',itemId:'124',name:'Organizador de armário (DADO FICTÍCIO)',productUrl:'https://shopee.com.br/product/456/124',price:'39.90',commissionRate:'0.075000',rating:'4.7' },
  { marketplace:'SHOPEE',shopId:'789',itemId:'125',name:'Organizador de gavetas (DADO FICTÍCIO)',productUrl:'https://shopee.com.br/product/789/125',price:'29.90',commissionRate:'0.110000',rating:'4.9' },
];
@Injectable()
export class MockOfferProvider implements OfferProvider {
  async search({ keyword, page, limit }: OfferSearch): Promise<OfferSearchResponse> {
    const words = keyword.toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean);
    const matched = FIXTURES.filter(item => words.some(word => item.name.toLocaleLowerCase('pt-BR').includes(word)));
    const offset = (page - 1) * limit;
    return { items: matched.slice(offset, offset + limit), pageInfo: { page, limit, hasNextPage: offset + limit < matched.length }, source: 'mock' };
  }
}
