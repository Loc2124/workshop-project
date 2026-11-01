import type { Workshop } from '../types/workshop';
import { rankWorkshops } from './rankWorkshops';

export function upcomingHomeWorkshops(source: Workshop[], limit = 5) {
  return rankWorkshops(source).slice(0, limit);
}
