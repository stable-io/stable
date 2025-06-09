import { Route } from "../../types/index.js";

export type RouteWithoutEstimates = Omit<Route, "estimatedDuration" | "estimatedTotalCost">;