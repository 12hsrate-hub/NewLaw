"use client";

import { useState } from "react";

import Link from "next/link";

import type { TrustorRegistryPrefillOption } from "@/lib/trustors/registry-prefill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function DocumentTrustorRegistryPrefill(props: {
  items: TrustorRegistryPrefillOption[];
  serverCode: string;
  onApply: (trustor: TrustorRegistryPrefillOption) => void;
}) {
  const [selectedTrustorId, setSelectedTrustorId] = useState("");
  const selectedTrustor =
    props.items.find((trustor) => trustor.id === selectedTrustorId) ?? null;
  const manageHref = `/account/trustors?server=${encodeURIComponent(props.serverCode)}`;

  if (!props.items.length) {
    return (
      <div className="space-y-2 rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4">
        <p className="text-sm leading-6 text-[var(--muted)]">
          На этом сервере пока нет reusable trustor cards в registry. Manual inline entry остаётся
          рабочим fallback.
        </p>
        <Link
          className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
          href={manageHref}
        >
          Открыть trustors registry
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white/60 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Prefill из trustors registry</h4>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Это только convenience prefill: значения копируются в local trustor snapshot документа и
          не создают live-связь с registry.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`trustor-registry-${props.serverCode}`}>
            Reusable trustor card
          </label>
          <Select
            id={`trustor-registry-${props.serverCode}`}
            onChange={(event) => {
              setSelectedTrustorId(event.target.value);
            }}
            value={selectedTrustorId}
          >
            <option value="">Выберите доверителя из registry</option>
            {props.items.map((trustor) => (
              <option key={trustor.id} value={trustor.id}>
                {trustor.fullName} ({trustor.passportNumber})
              </option>
            ))}
          </Select>
        </div>
        <Button
          disabled={!selectedTrustor}
          onClick={() => {
            if (selectedTrustor) {
              props.onApply(selectedTrustor);
            }
          }}
          type="button"
          variant="secondary"
        >
          Подставить из registry
        </Button>
        <Link
          className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2 text-sm font-medium transition hover:bg-white"
          href={manageHref}
        >
          Открыть registry
        </Link>
      </div>

      {selectedTrustor ? (
        <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-white/80 p-4 text-sm leading-6 text-[var(--muted)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{selectedTrustor.fullName}</Badge>
            <Badge className="bg-white/70 text-[var(--foreground)]">
              {selectedTrustor.isRepresentativeReady
                ? "Готов для representative flow"
                : "Нужны обязательные поля"}
            </Badge>
          </div>
          <p>
            Паспорт:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {selectedTrustor.passportNumber}
            </span>
          </p>
          {selectedTrustor.phone ? (
            <p>
              Телефон registry:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.phone}
              </span>
            </p>
          ) : null}
          {selectedTrustor.icEmail ? (
            <p>
              IC email registry:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.icEmail}
              </span>
            </p>
          ) : null}
          {selectedTrustor.passportImageUrl ? (
            <p>
              Скрин паспорта registry:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.passportImageUrl}
              </span>
            </p>
          ) : null}
          {selectedTrustor.note ? (
            <p>
              Note для snapshot:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.note}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
