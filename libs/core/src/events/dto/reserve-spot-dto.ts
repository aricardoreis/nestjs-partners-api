import { TicketKind } from '@prisma/client';

export class ReserveSpotDto {
  spots: string[];
  kind: TicketKind;
  email: string;
}
