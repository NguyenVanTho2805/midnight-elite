import { route } from "@/server/api";
import { cuaToi } from "@/server/hs";

export const GET = route((u) => cuaToi(u));
