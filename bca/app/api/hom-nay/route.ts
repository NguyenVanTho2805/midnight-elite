import { route } from "@/server/api";
import { homNay } from "@/server/hom-nay";

export const GET = route((u) => homNay(u));
