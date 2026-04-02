import { BadRequestException } from '@nestjs/common';

type ProjectCursor = {
  id: string;
  updatedAt: Date;
};

export function encodeProjectCursor(cursor: ProjectCursor) {
  return Buffer.from(
    JSON.stringify({
      id: cursor.id,
      updatedAt: cursor.updatedAt.toISOString()
    }),
    'utf8'
  ).toString('base64url');
}

export function decodeProjectCursor(rawCursor?: string) {
  if (!rawCursor) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as {
      id?: string;
      updatedAt?: string;
    };

    if (!parsed.id || !parsed.updatedAt) {
      throw new Error('Cursor is incomplete.');
    }

    const updatedAt = new Date(parsed.updatedAt);

    if (Number.isNaN(updatedAt.getTime())) {
      throw new Error('Cursor timestamp is invalid.');
    }

    return {
      id: parsed.id,
      updatedAt
    };
  } catch {
    throw new BadRequestException('Cursor is invalid.');
  }
}
