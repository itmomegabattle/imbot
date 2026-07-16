import { Context } from "grammy";
import { AccessLevel } from "../api/types";

export interface SigmaFlavor {
  accessLevel: AccessLevel;
}

export type SigmaContext = Context & SigmaFlavor;
