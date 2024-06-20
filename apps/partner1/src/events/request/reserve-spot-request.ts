import { TicketKind } from '@prisma/client';

export class ReserveSpotRequest {
  spots: string[];
  kind: TicketKind;
  email: string;
}
