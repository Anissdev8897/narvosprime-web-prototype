import { Merchant } from '../types';
import { STATIC_MERCHANTS } from './static-data';

// Use the generated static merchants
export const DEFAULT_MERCHANTS: Merchant[] = STATIC_MERCHANTS;

export const getMerchantById = (id: string) => DEFAULT_MERCHANTS.find(m => m.id === id);
