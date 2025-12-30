import { describe, it, expect } from "vitest";
import { CommunicationStore, expandTemplate, validateContent } from "@/services/communication-service";

describe("communications", () => {
  it("expands variables in templates", () => {
    const content = expandTemplate("Hola {{name}}, número {{id}}", { name: "Ana", id: 123 });
    expect(content).toContain("Hola Ana");
    expect(content).toContain("número 123");
  });

  it("validates SMS length", () => {
    const { valid } = validateContent("sms", "x".repeat(160));
    expect(valid).toBe(true);
    const invalid = validateContent("sms", "x".repeat(161));
    expect(invalid.valid).toBe(false);
  });
});