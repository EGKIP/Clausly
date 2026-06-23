import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { KeyDate } from "@/lib/db/types";
import type { Clause } from "@/lib/mock-clauses";
import type { ContractDoc } from "@/lib/mock-data";
import type { Reminder } from "@/lib/mock-reminders";

type ExportInput = {
  document: ContractDoc;
  clauses: Clause[];
  dates: KeyDate[];
  reminders: Reminder[];
};

const brand = {
  ink: "#1f2937",
  muted: "#5f6b7a",
  border: "#ded6c9",
  surface: "#fbf7ef",
  accent: "#0f766e",
  danger: "#b42318",
  warn: "#a16207",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    color: brand.ink,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  eyebrow: {
    color: brand.accent,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    lineHeight: 1.15,
    marginBottom: 8,
  },
  subtitle: {
    color: brand.muted,
    fontSize: 11,
    marginBottom: 18,
  },
  card: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    backgroundColor: brand.surface,
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 8,
    color: brand.ink,
  },
  body: {
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  muted: {
    color: brand.muted,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: brand.border,
    paddingTop: 8,
    marginTop: 8,
  },
  rowTitle: {
    fontSize: 10.5,
    marginBottom: 3,
  },
  badge: {
    fontSize: 8,
    color: brand.accent,
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    color: brand.muted,
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: brand.border,
    paddingTop: 8,
  },
});

export async function renderDocumentPdf(input: ExportInput): Promise<Buffer> {
  return renderToBuffer(createPdfDocument(input));
}

function createPdfDocument({ document, clauses, dates, reminders }: ExportInput) {
  return React.createElement(
    Document,
    { title: `${document.title} export` },
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page, wrap: true },
      section("Clausly export", [
        React.createElement(Text, { key: "title", style: styles.title }, document.title),
        React.createElement(
          Text,
          { key: "subtitle", style: styles.subtitle },
          `${document.party} · ${document.type} · ${document.jurisdiction} · ${document.pages} pages`
        ),
      ]),
      card("Summary", [
        React.createElement(Text, { key: "summary", style: styles.body }, document.summary),
        React.createElement(
          Text,
          { key: "dates", style: [styles.body, styles.muted] },
          `Effective: ${document.effective} · Ends: ${document.ends}${document.noticeBy ? ` · Notice by: ${document.noticeBy}` : ""}`
        ),
      ]),
      card("Clauses", clauses.slice(0, 10).map((clause) =>
        row(clause.id, [
          React.createElement(Text, { key: "badge", style: styles.badge }, `${clause.category} · ${clause.risk} · p. ${clause.page}`),
          React.createElement(Text, { key: "title", style: styles.rowTitle }, clause.title),
          React.createElement(Text, { key: "plain", style: styles.body }, clause.plainEnglish),
          React.createElement(Text, { key: "quote", style: [styles.body, styles.muted] }, `Source: "${clause.quote}"`),
        ])
      )),
      card("Dates", dates.length > 0 ? dates.map((date) =>
        row(date.id, [
          React.createElement(Text, { key: "title", style: styles.rowTitle }, `${date.label} · ${date.date}`),
          React.createElement(Text, { key: "kind", style: [styles.body, styles.muted] }, date.kind),
          date.description ? React.createElement(Text, { key: "description", style: styles.body }, date.description) : null,
        ])
      ) : [emptyText("No key dates extracted.")]),
      card("Reminders", reminders.length > 0 ? reminders.map((reminder) =>
        row(reminder.id, [
          React.createElement(Text, { key: "title", style: styles.rowTitle }, `${reminder.title} · ${reminder.status}`),
          React.createElement(Text, { key: "date", style: [styles.body, styles.muted] }, reminder.fireOn),
          React.createElement(Text, { key: "description", style: styles.body }, reminder.description),
        ])
      ) : [emptyText("No reminders for this document.")]),
      React.createElement(
        Text,
        { style: styles.footer, fixed: true },
        "Informational only - not legal advice. Review the original contract and consult a licensed attorney for legal questions."
      )
    )
  );
}

function section(label: string, children: React.ReactNode[]) {
  return React.createElement(
    View,
    { style: { marginBottom: 10 } },
    React.createElement(Text, { style: styles.eyebrow }, label),
    ...children
  );
}

function card(title: string, children: React.ReactNode[]) {
  return React.createElement(
    View,
    { style: styles.card },
    React.createElement(Text, { style: styles.sectionTitle }, title),
    ...children.filter(Boolean)
  );
}

function row(key: string, children: Array<React.ReactNode | null>) {
  return React.createElement(View, { key, style: styles.row }, ...children.filter(Boolean));
}

function emptyText(value: string) {
  return React.createElement(Text, { key: value, style: [styles.body, styles.muted] }, value);
}
