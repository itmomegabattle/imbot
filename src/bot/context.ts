import { Context } from "grammy";
import { AccessLevel } from "../api/types";
import { BotUser } from "../state/userStore";

export interface SigmaFlavor {
  accessLevel: AccessLevel;
  botUser: BotUser;
}

export type SigmaContext = Context & SigmaFlavor;
