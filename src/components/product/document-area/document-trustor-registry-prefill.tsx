"use client";

import { useState } from "react";

import Link from "next/link";

import type { TrustorRegistryPrefillOption } from "@/lib/trustors/registry-prefill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmbeddedCard } from "@/components/ui/embedded-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

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
      <EmbeddedCard className="space-y-2 border-dashed bg-[var(--surface-embedded)]">
        <p className="text-sm leading-6 text-[var(--muted)]">
          На этом сервере пока нет сохранённых доверителей. Можно заполнить данные доверителя
          вручную прямо в документе.
        </p>
        <Link
          className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
          href={manageHref}
        >
          Открыть список доверителей
        </Link>
      </EmbeddedCard>
    );
  }

  return (
    <EmbeddedCard className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Подставить доверителя из списка</h4>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Данные будут скопированы в этот документ. Если позже изменить карточку доверителя в
          списке, уже заполненный документ сам не изменится.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor={`trustor-registry-${props.serverCode}`}>
            Доверитель
          </label>
          <Select
            id={`trustor-registry-${props.serverCode}`}
            onChange={(event) => {
              setSelectedTrustorId(event.target.value);
            }}
            value={selectedTrustorId}
          >
            <option value="">Выберите доверителя из списка</option>
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
          Подставить в документ
        </Button>
        <Link
          className="inline-flex items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)]"
          href={manageHref}
        >
          Открыть список
        </Link>
      </div>

      {selectedTrustor ? (
        <EmbeddedCard className="space-y-2 bg-[var(--surface-subtle)] text-sm leading-6 text-[var(--muted)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{selectedTrustor.fullName}</Badge>
            <StatusBadge tone={selectedTrustor.isRepresentativeReady ? "success" : "warning"}>
              {selectedTrustor.isRepresentativeReady
                ? "Готов для подачи через представителя"
                : "Нужны обязательные поля"}
            </StatusBadge>
          </div>
          <p>
            Паспорт:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {selectedTrustor.passportNumber}
            </span>
          </p>
          {selectedTrustor.phone ? (
            <p>
              Телефон:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.phone}
              </span>
            </p>
          ) : null}
          {selectedTrustor.icEmail ? (
            <p>
              Игровая почта:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.icEmail}
              </span>
            </p>
          ) : null}
          {selectedTrustor.passportImageUrl ? (
            <p>
              Скрин паспорта:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.passportImageUrl}
              </span>
            </p>
          ) : null}
          {selectedTrustor.note ? (
            <p>
              Примечание:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {selectedTrustor.note}
              </span>
            </p>
          ) : null}
        </EmbeddedCard>
      ) : null}
    </EmbeddedCard>
  );
}
