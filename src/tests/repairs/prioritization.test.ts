import { describe, it, expect } from "vitest";
import type { RepairOrder } from "@/types/repairs";
import { calculatePriorityScore, defaultPriorityConfig, sortRepairsByPriority } from "@/services/repair-priority";

describe("repair prioritization", () => {
  it("calculates higher score for urgent and long-waiting repairs", () => {
    const now = Date.now();
    const a = { id: "A", customerName: "X", deviceModel: "M", issueDescription: "", urgency: 5, createdAt: new Date(now - 96 * 3600 * 1000).toISOString(), stage: "diagnosis" } as unknown as RepairOrder;
    const b = { id: "B", customerName: "Y", deviceModel: "M", issueDescription: "", urgency: 1, createdAt: new Date(now - 6 * 3600 * 1000).toISOString(), stage: "diagnosis" } as unknown as RepairOrder;
    const scoreA = calculatePriorityScore(a, defaultPriorityConfig);
    const scoreB = calculatePriorityScore(b, defaultPriorityConfig);
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("sorts repairs by descending score", () => {
    const now = Date.now();
    const list: RepairOrder[] = [
      { id: "A", customerName: "X", deviceModel: "M", issueDescription: "", urgency: 2, createdAt: new Date(now - 10 * 3600 * 1000).toISOString(), stage: "diagnosis" } as unknown as RepairOrder,
      { id: "B", customerName: "Y", deviceModel: "M", issueDescription: "", urgency: 5, createdAt: new Date(now - 100 * 3600 * 1000).toISOString(), stage: "diagnosis" } as unknown as RepairOrder,
    ];
    const sorted = sortRepairsByPriority(list, defaultPriorityConfig);
    expect(sorted[0].id).toBe("B");
  });
});