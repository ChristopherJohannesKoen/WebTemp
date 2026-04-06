import { Prisma } from '@prisma/client';

export const publicUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  name: true,
  role: true,
  disabledAt: true,
  provisionedBy: true
});

export const projectWithCreatorSelect = Prisma.validator<Prisma.ProjectSelect>()({
  id: true,
  name: true,
  description: true,
  status: true,
  isArchived: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
  creator: {
    select: publicUserSelect
  }
});

export type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type ProjectWithCreatorRecord = Prisma.ProjectGetPayload<{
  select: typeof projectWithCreatorSelect;
}>;
