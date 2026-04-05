import process from 'node:process';
import { Prisma, PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const bootstrapStateId = 1;

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

function isSerializableConflict(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ['P2002', 'P2034'].includes(error.code)
  );
}

async function runSerializableRetry(label, callback, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (isSerializableConflict(error) && attempt < maxAttempts) {
        continue;
      }

      if (isSerializableConflict(error)) {
        throw new Error(`Failed to complete ${label} after ${maxAttempts} serializable attempts.`);
      }

      throw error;
    }
  }

  throw new Error(`Failed to complete ${label}.`);
}

async function ensureBootstrapOwner(ownerSeed) {
  const passwordHash = await buildHash(ownerSeed.password);

  return runSerializableRetry('bootstrap owner provisioning', async (transaction) => {
    const bootstrapState = await transaction.bootstrapState.findUnique({
      where: { id: bootstrapStateId },
      include: {
        bootstrapOwner: true
      }
    });

    if (bootstrapState) {
      if (bootstrapState.bootstrapOwner.email !== ownerSeed.email) {
        throw new Error(
          `Bootstrap owner mismatch. Existing bootstrap owner is ${bootstrapState.bootstrapOwner.email}, but SEED_OWNER_EMAIL is ${ownerSeed.email}.`
        );
      }

      return {
        owner: bootstrapState.bootstrapOwner,
        bootstrapStatus: 'existing'
      };
    }

    let owner = await transaction.user.findUnique({
      where: { email: ownerSeed.email }
    });

    if (!owner) {
      owner = await transaction.user.create({
        data: {
          email: ownerSeed.email,
          name: ownerSeed.name,
          role: ownerSeed.role,
          passwordHash
        }
      });
    } else {
      owner = await transaction.user.update({
        where: { id: owner.id },
        data: {
          name: ownerSeed.name,
          role: 'owner',
          passwordHash
        }
      });
    }

    await transaction.bootstrapState.create({
      data: {
        id: bootstrapStateId,
        bootstrapOwnerId: owner.id
      }
    });

    return {
      owner,
      bootstrapStatus: 'created'
    };
  });
}

async function upsertSeedUser(seedUser) {
  if (seedUser.role === 'owner') {
    throw new Error('upsertSeedUser should not be used for owner bootstrap.');
  }

  const passwordHash = await buildHash(seedUser.password);

  return prisma.user.upsert({
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
}

async function main() {
  if (dryRun) {
    await buildHash('dry-run-check-password');
    console.log('Seed dry run completed.');
    return;
  }

  const [ownerSeed, ...otherSeedUsers] = roleDefaults;
  const { owner, bootstrapStatus } = await ensureBootstrapOwner(ownerSeed);

  for (const seedUser of otherSeedUsers) {
    await upsertSeedUser(seedUser);
  }

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

  console.log(
    `Seed complete. Owner email: ${owner.email}. Bootstrap state: ${bootstrapStatus}.`
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
