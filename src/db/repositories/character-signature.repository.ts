import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";

type PrismaLike = PrismaClient;

export async function createCharacterSignatureRecord(
  input: {
    id: string;
    characterId: string;
    storagePath: string;
    mimeType: string;
    width: number;
    height: number;
    fileSize: number;
  },
  db: PrismaLike = prisma,
) {
  return db.characterSignature.create({
    data: {
      id: input.id,
      characterId: input.characterId,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      width: input.width,
      height: input.height,
      fileSize: input.fileSize,
      isActive: true,
    },
  });
}

export async function createAndActivateCharacterSignatureRecord(
  input: {
    id: string;
    characterId: string;
    storagePath: string;
    mimeType: string;
    width: number;
    height: number;
    fileSize: number;
  },
  db: PrismaLike = prisma,
) {
  return db.$transaction(async (tx) => {
    await tx.characterSignature.updateMany({
      where: {
        characterId: input.characterId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const signature = await tx.characterSignature.create({
      data: {
        id: input.id,
        characterId: input.characterId,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        fileSize: input.fileSize,
        isActive: true,
      },
    });

    await tx.character.update({
      where: {
        id: input.characterId,
      },
      data: {
        activeSignatureId: signature.id,
      },
    });

    return signature;
  });
}

export async function activateCharacterSignatureRecord(
  input: {
    characterId: string;
    signatureId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.$transaction(async (tx) => {
    await tx.characterSignature.updateMany({
      where: {
        characterId: input.characterId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const signature = await tx.characterSignature.update({
      where: {
        id: input.signatureId,
      },
      data: {
        isActive: true,
      },
    });

    await tx.character.update({
      where: {
        id: input.characterId,
      },
      data: {
        activeSignatureId: input.signatureId,
      },
    });

    return signature;
  });
}

export async function clearCharacterActiveSignatureRecord(
  input: {
    characterId: string;
    signatureId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.$transaction(async (tx) => {
    await tx.character.update({
      where: {
        id: input.characterId,
      },
      data: {
        activeSignatureId: null,
      },
    });

    return tx.characterSignature.update({
      where: {
        id: input.signatureId,
      },
      data: {
        isActive: false,
      },
    });
  });
}

export async function getCharacterSignatureById(
  input: {
    signatureId: string;
  },
  db: PrismaLike = prisma,
) {
  return db.characterSignature.findUnique({
    where: {
      id: input.signatureId,
    },
  });
}
