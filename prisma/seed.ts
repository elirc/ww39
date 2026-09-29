/**
 * What this file does: seeds a realistic support org with users, groups, SLAs, and rules.
 * What calls it: Prisma seed workflows in a developer environment.
 * What it calls: Prisma client and password hashing helpers.
 * Junior trap: seeding everything into one flat roleless account and masking permission bugs.
 */
import { PrismaClient, Role, TicketPriority } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.assignmentRule.deleteMany();
  await prisma.escalationRule.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.supportGroup.deleteMany();

  const hashed = await hashPassword("Password123!");

  const platform = await prisma.supportGroup.create({ data: { name: "Platform" } });
  const billing = await prisma.supportGroup.create({ data: { name: "Billing" } });

  await prisma.slaPolicy.createMany({
    data: [
      {
        name: "Platform Normal",
        groupId: platform.id,
        priority: TicketPriority.NORMAL,
        firstResponseMins: 240,
        resolutionMins: 1440,
        isActive: true
      },
      {
        name: "Platform Urgent",
        groupId: platform.id,
        priority: TicketPriority.URGENT,
        firstResponseMins: 30,
        resolutionMins: 240,
        isActive: true
      },
      {
        name: "Billing Normal",
        groupId: billing.id,
        priority: TicketPriority.NORMAL,
        firstResponseMins: 180,
        resolutionMins: 1440,
        isActive: true
      }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        email: "admin@atlas.local",
        displayName: "Admin User",
        passwordHash: hashed,
        role: Role.ADMIN,
        supportGroupId: null
      },
      {
        email: "manager@atlas.local",
        displayName: "Platform Manager",
        passwordHash: hashed,
        role: Role.MANAGER,
        supportGroupId: platform.id
      },
      {
        email: "agent@atlas.local",
        displayName: "Platform Agent",
        passwordHash: hashed,
        role: Role.AGENT,
        supportGroupId: platform.id
      },
      {
        email: "customer@atlas.local",
        displayName: "Billing Customer",
        passwordHash: hashed,
        role: Role.CUSTOMER,
        supportGroupId: billing.id
      }
    ]
  });

  const agent = await prisma.user.findUniqueOrThrow({ where: { email: "agent@atlas.local" } });
  await prisma.assignmentRule.create({
    data: {
      name: "Urgent platform tickets to agent",
      groupId: platform.id,
      priority: TicketPriority.URGENT,
      targetUserId: agent.id,
      isActive: true
    }
  });

  await prisma.escalationRule.create({
    data: {
      name: "Platform urgent escalates to billing manager after 60 minutes",
      groupId: platform.id,
      priority: TicketPriority.URGENT,
      afterMins: 60,
      targetGroupId: billing.id,
      isActive: true
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
