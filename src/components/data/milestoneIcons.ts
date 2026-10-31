import {
  Award,
  Flame,
  Gauge,
  Handshake,
  PartyPopper,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { MilestoneKind } from "@shared/domain";

export const MILESTONE_ICONS: Record<MilestoneKind, LucideIcon> = {
  franchise_record: Trophy,
  career_high: TrendingUp,
  threshold_game: Sparkles,
  first_threshold_season: Award,
  streak: Flame,
  first_td: PartyPopper,
  game_winner: Trophy,
  connection: Handshake,
  mark: Gauge,
  player_streak: Flame,
  team_record: Trophy,
  custom: Sparkles,
};
