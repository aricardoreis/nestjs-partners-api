import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ReserveSpotDto } from './dto/reserve-spot-dto';
import { Prisma, TicketStatus } from '.prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prismaService: PrismaService) {
    const count = this.prismaService.event.count();
    console.info(`events count: ${count}`);
  }

  create(createEventDto: CreateEventDto) {
    return this.prismaService.event.create({
      data: { ...createEventDto, date: new Date(createEventDto.date) },
    });
  }

  findAll() {
    return this.prismaService.event.findMany();
  }

  findOne(id: string) {
    return this.prismaService.event.findUnique({ where: { id } });
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    return this.prismaService.event.update({
      data: { ...updateEventDto, date: new Date(updateEventDto.date) },
      where: { id },
    });
  }

  remove(id: string) {
    return this.prismaService.event.delete({ where: { id } });
  }

  async reserveSpots(dto: ReserveSpotDto & { eventId: string }) {
    const spots = await this.prismaService.spot.findMany({
      where: { name: { in: dto.spots }, eventId: dto.eventId },
    });

    if (spots.length !== dto.spots.length) {
      const notFoundSpotsName = dto.spots.filter(
        (spot) => !spots.some((s) => s.name === spot),
      );
      throw new Error(`Spots not found: ${notFoundSpotsName.join(', ')}`);
    }

    // transaction
    try {
      const tickets = await this.prismaService.$transaction(
        async (prisma) => {
          await prisma.reservationHistory.createMany({
            data: spots.map((spot) => ({
              spotId: spot.id,
              email: dto.email,
              kind: dto.kind,
              status: TicketStatus.reserved,
            })),
          });

          await prisma.spot.updateMany({
            data: { status: TicketStatus.reserved },
            where: { id: { in: dto.spots }, eventId: dto.eventId },
          });

          return await Promise.all(
            spots.map((spot) =>
              prisma.ticket.create({
                data: { spotId: spot.id, email: dto.email, kind: dto.kind },
              }),
            ),
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );

      return tickets;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case 'P2002': // duplicate key value violates unique constraint
          case 'P2034': // transaction conflict
            throw new Error('Some spots are already reserved');
        }
      }

      // unexpected error, re-throw
      throw e;
    }
  }
}
