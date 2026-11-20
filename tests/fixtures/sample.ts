// Deterministisches Testdokument: Behörde mit 2 Abteilungen, Referaten, Stab, Projekten, Beziehungen.
import { defaultSettings, defaultView, type OrgDocument, type OrgUnit } from "../../src/core/model.ts";

const u = (id: string, parentId: string | null, name: string, extra: Partial<OrgUnit> = {}): OrgUnit => ({
  id,
  parentId,
  name,
  ...extra,
});

export function sampleDoc(): OrgDocument {
  return {
    format: "orgamorph",
    schemaVersion: 1,
    id: "d_testdoc001",
    meta: { title: "Testbehörde", created: "2026-01-01T00:00:00.000Z", modified: "2026-01-01T00:00:00.000Z" },
    units: [
      u("u_root000001", null, "Behördenleitung", { shortName: "BL", lead: { title: "Leitung", code: "L" } }),
      u("u_stab000001", "u_root000001", "Stab", { shortName: "Stab", isStaff: true }),
      u("u_abt1000001", "u_root000001", "Abteilung 1", {
        shortName: "Abt 1",
        type: "Abteilung",
        lead: { title: "Abteilungsleitung", code: "A1", positionNumber: "01.100", holder: "Max Mustermann" },
      }),
      u("u_ref1100001", "u_abt1000001", "Referat 1.1", { shortName: "Ref 1.1" }),
      u("u_ref1200001", "u_abt1000001", "Referat 1.2", { shortName: "Ref 1.2" }),
      u("u_ref1300001", "u_abt1000001", "Referat 1.3", { shortName: "Ref 1.3" }),
      u("u_abt2000001", "u_root000001", "Abteilung 2", { shortName: "Abt 2" }),
      u("u_ref2100001", "u_abt2000001", "Referat 2.1", { shortName: "Ref 2.1" }),
      u("u_ref2200001", "u_abt2000001", "Referat 2.2", { shortName: "Ref 2.2" }),
    ],
    topics: [
      {
        id: "t_digital001",
        title: "Digitalisierung",
        type: "project",
        period: { from: "2026-01-01", to: "2026-12-31" },
        participants: [
          { unitId: "u_ref1100001", role: "lead" },
          { unitId: "u_ref2100001", role: "member" },
          { unitId: "u_stab000001", role: "member" },
        ],
        color: "#0072B2",
      },
      {
        id: "t_haushalt01",
        title: "AG Haushalt",
        type: "workingGroup",
        period: {},
        participants: [
          { unitId: "u_ref1100001", role: "member" },
          { unitId: "u_ref2100001", role: "lead" },
        ],
        color: "#E69F00",
      },
      {
        id: "t_alt0000001",
        title: "Altprojekt",
        type: "project",
        period: { from: "2024-01-01", to: "2024-12-31" },
        participants: [
          { unitId: "u_ref1200001", role: "lead" },
          { unitId: "u_ref2200001", role: "member" },
        ],
        color: "#009E73",
      },
    ],
    relations: [
      { id: "r_rel0000001", from: "u_ref1300001", to: "u_abt2000001", kind: "reportsTo" },
      { id: "r_rel0000002", from: "u_stab000001", to: "u_ref1200001", kind: "informs" },
    ],
    settings: defaultSettings(),
    view: defaultView(),
  };
}
