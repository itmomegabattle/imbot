import { NextFunction } from "grammy";
import { SigmaContext } from "../context";
import { getAccessLevel } from "../../services/auth";
import { AccessLevel } from "../../api/types";
import { logger } from "../../logger";

/**
 * Определяет access level текущего пользователя (NOBODY/USER/MANAGER) и кладёт
 * его в ctx вместе с записью BotUser. Не блокирует апдейт — конкретные команды
 * сами решают, какой уровень им нужен (см. requireAccess ниже).
 */
export async function accessControl(ctx: SigmaContext, next: NextFunction) {
  ctx.accessLevel = AccessLevel.NOBODY;
  const tgId = ctx.from?.id;
  if (tgId === undefined) {
    return next();
  }
  try {
    ctx.accessLevel = await getAccessLevel(ctx.from!);
  } catch (err) {
    logger.error(`accessControl: failed to resolve access level for ${tgId}`, err);
    ctx.accessLevel = AccessLevel.NOBODY;
  }
  return next();
}

const LEVEL_ORDER: Record<AccessLevel, number> = {
  [AccessLevel.NOBODY]: 0,
  [AccessLevel.USER]: 1,
  [AccessLevel.MANAGER]: 2,
};

/** Фабрика middleware, отсекающего команды по минимальному уровню доступа. */
export function requireAccess(minLevel: AccessLevel) {
  return async (ctx: SigmaContext, next: NextFunction) => {
    if (LEVEL_ORDER[ctx.accessLevel] < LEVEL_ORDER[minLevel]) {
      await ctx.reply(
        minLevel === AccessLevel.MANAGER
          ? "Эта команда доступна только организаторам."
          : "Сначала нужно зарегистрироваться — отправьте /start.",
      );
      return;
    }
    return next();
  };
}
