import process from 'node:process';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const roleDefaults = [
  {
    email: process.env.SEED_OWNER_EMAIL ?? 'owner@example.com',
    password: process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!',
    name: 'Template Owner',
    role: 'owner'
  },
  {
    email: 'admin@example.com',
    password: 'ChangeMe123!',
    name: 'Template Admin',
    role: 'admin'
  },
  {
    email: 'member@example.com',
    password: 'ChangeMe123!',
    name: 'Template Member',
    role: 'member'
  }
];

const projectDefaults = [
  {
    name: 'Launch marketing refresh',
    description: 'Coordinate launch assets, landing updates, and release notes.',
    status: 'active',
    isArchived: false
  },
  {
    name: 'Quarterly analytics review',
    description: 'Audit funnel performance and identify onboarding friction.',
    status: 'paused',
    isArchived: false
  },
  {
    name: 'Migration playbook',
    description: 'Document the production rollout and rollback sequence.',
    status: 'completed',
    isArchived: true
  }
];

async function buildHash(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? '19456')
  });
}

async function main() {
  if (dryRun) {
    await buildHash('dry-run-check-password');
    console.log('Seed dry run completed.');
    return;
  }

  const users = [];

  for (const seedUser of roleDefaults) {
    const passwordHash = await buildHash(seedUser.password);
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      create: {
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
        passwordHash
      },
      update: {
        name: seedUser.name,
        role: seedUser.role,
        passwordHash
      }
    });

    users.push(user);
  }

  const owner = users[0];

  for (const project of projectDefaults) {
    const exists = await prisma.project.findFirst({
      where: {
        name: project.name,
        creatorId: owner.id
      }
    });

    if (!exists) {
      await prisma.project.create({
        data: {
          ...project,
          creatorId: owner.id
        }
      });
    }
  }

  console.log(`Seed complete. Owner email: ${owner.email}`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
