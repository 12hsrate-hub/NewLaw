import { describe, expect, it } from "vitest";

import {
  buildCitationConstraints,
  buildCitationDiagnostics,
  mergeExplicitLegalCitations,
  parseExplicitLegalCitations,
} from "@/server/legal-core/legal-citation-parser";

describe("legal citation parser", () => {
  it("распознает базовые формы АК/ПК/УК/ЗоА как citation candidates", () => {
    expect(parseExplicitLegalCitations("22 ч.1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        lawFamily: "administrative_code",
        articleNumber: "22",
        partNumber: "1",
        pointNumber: null,
        resolutionStatus: "not_attempted",
      }),
    ]);

    expect(parseExplicitLegalCitations("23.1 ПК")).toEqual([
      expect.objectContaining({
        lawCode: "ПК",
        lawFamily: "procedural_code",
        articleNumber: "23.1",
        partNumber: null,
        pointNumber: null,
      }),
    ]);

    expect(parseExplicitLegalCitations("84 УК")).toEqual([
      expect.objectContaining({
        lawCode: "УК",
        lawFamily: "criminal_code",
        articleNumber: "84",
      }),
    ]);

    expect(parseExplicitLegalCitations("5 ч.4 Закона об адвокатуре")).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);
  });

  it("поддерживает вариативные формы статьи и различает article.decimal и article+part", () => {
    expect(parseExplicitLegalCitations("ст. 22 ч. 1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        articleNumber: "22",
        partNumber: "1",
        pointNumber: null,
      }),
    ]);

    expect(parseExplicitLegalCitations("АК 22 ч.1")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);

    expect(parseExplicitLegalCitations("АК ст 22")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        articleNumber: "22",
        partNumber: null,
      }),
    ]);

    expect(parseExplicitLegalCitations("22.1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        articleNumber: "22.1",
        partNumber: null,
      }),
    ]);

    expect(parseExplicitLegalCitations("22 ч 1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);

    expect(parseExplicitLegalCitations("22 часть 1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);
  });

  it("распознает point marker без попытки resolver", () => {
    expect(parseExplicitLegalCitations("ст. 23 ч.1 п. «в» ПК")).toEqual([
      expect.objectContaining({
        lawCode: "ПК",
        articleNumber: "23",
        partNumber: "1",
        pointNumber: "в",
        resolutionStatus: "not_attempted",
      }),
    ]);
  });

  it("поддерживает citation формы с предлогом по", () => {
    expect(parseExplicitLegalCitations("можно ли по 23.1 ПК")).toEqual([
      expect.objectContaining({
        lawCode: "ПК",
        lawFamily: "procedural_code",
        articleNumber: "23.1",
        partNumber: null,
      }),
    ]);

    expect(parseExplicitLegalCitations("допустимо ли по 22 ч.1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        lawFamily: "administrative_code",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);

    expect(parseExplicitLegalCitations("привлечь по 84 УК")).toEqual([
      expect.objectContaining({
        lawCode: "УК",
        lawFamily: "criminal_code",
        articleNumber: "84",
        partNumber: null,
      }),
    ]);

    expect(parseExplicitLegalCitations("по статье 23.1 ПК")).toEqual([
      expect.objectContaining({
        lawCode: "ПК",
        lawFamily: "procedural_code",
        articleNumber: "23.1",
        partNumber: null,
      }),
    ]);
  });

  it("сохраняет partNumber для long-title forms закона об адвокатуре", () => {
    expect(parseExplicitLegalCitations("5 ч.4 Закона об адвокатуре")).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);

    expect(parseExplicitLegalCitations("5 часть 4 Закона об адвокатуре")).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);

    expect(parseExplicitLegalCitations("ст. 5 ч.4 Закона об адвокатуре")).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);

    expect(parseExplicitLegalCitations("статья 5, часть 4, закона об адвокатуре")).toEqual([
      expect.objectContaining({
        lawCode: "ЗоА",
        lawFamily: "advocacy_law",
        articleNumber: "5",
        partNumber: "4",
      }),
    ]);
  });

  it("поддерживает normalized-style формы статьи и подпункта после normalizer drift", () => {
    expect(parseExplicitLegalCitations("статьи 22 части 1 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        lawFamily: "administrative_code",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);

    expect(parseExplicitLegalCitations("пункт 1 статьи 22 АК")).toEqual([
      expect.objectContaining({
        lawCode: "АК",
        lawFamily: "administrative_code",
        articleNumber: "22",
        partNumber: "1",
      }),
    ]);
  });

  it("не считает жалобу в ОГП explicit citation без article marker", () => {
    expect(parseExplicitLegalCitations("хочу подать жалобу в ОГП")).toEqual([]);
  });

  it("считает статью закона об ОГП citation candidate", () => {
    expect(parseExplicitLegalCitations("что написано в ст. 10 Закона об ОГП")).toEqual([
      expect.objectContaining({
        lawCode: "ОГП",
        lawFamily: "government_code",
        lawFamilyDiagnosticHint: "prosecutor_office_scope",
        articleNumber: "10",
        resolutionStatus: "not_attempted",
      }),
    ]);
  });

  it("возвращает diagnostic hints для ДК и ТК без runtime law family", () => {
    expect(parseExplicitLegalCitations("22 ДК")).toEqual([
      expect.objectContaining({
        lawCode: "ДК",
        lawFamily: null,
        lawFamilyDiagnosticHint: "traffic_code",
        articleNumber: "22",
      }),
    ]);

    expect(parseExplicitLegalCitations("ст. 4 ТК")).toEqual([
      expect.objectContaining({
        lawCode: "ТК",
        lawFamily: null,
        lawFamilyDiagnosticHint: "labor_code",
        articleNumber: "4",
      }),
    ]);
  });

  it("строит diagnostics-only constraints без resolver claims", () => {
    const citations = parseExplicitLegalCitations("что значит 84 УК");
    const merged = mergeExplicitLegalCitations({
      rawCitations: citations,
      normalizedCitations: citations,
    });

    expect(buildCitationConstraints(citations)).toEqual({
      restrictToExplicitLawFamily: true,
      restrictToExplicitArticle: true,
      restrictToExplicitPart: false,
      allowCompanionContext: true,
      semanticRetrievalAllowedAsCompanionOnly: false,
    });

    expect(buildCitationDiagnostics(merged)).toEqual({
      citation_resolved: false,
      citation_unresolved: false,
      citation_ambiguous: false,
      semantic_retrieval_overrode_explicit_citation: false,
      raw_citation_count: 1,
      normalized_citation_count: 1,
      merged_citation_count: 1,
      normalized_citations_discarded_count: 0,
      citation_merge_strategy: "raw_preferred",
      citation_normalization_drift_detected: false,
    });
  });
});
