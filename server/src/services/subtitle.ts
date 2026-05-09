import { readFileSync } from "fs";
import { parse as csvParse } from "csv-parse/sync";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

// ─── Parse uploaded file ────────────────────────────────────

export function parseTextFile(filePath: string, fileName: string): ParsedData {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "csv") {
    return parseCSV(filePath);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseExcel(filePath);
  }
  throw new Error(`Unsupported file format: .${ext}`);
}

function parseCSV(filePath: string): ParsedData {
  const content = readFileSync(filePath, "utf-8");
  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records, rowCount: records.length };
}

function parseExcel(filePath: string): ParsedData {
  const workbook = xlsxRead(filePath, { type: "file" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [], rowCount: 0 };

  const sheet = workbook.Sheets[sheetName];
  const records = xlsxUtils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records, rowCount: records.length };
}

// ─── Substitute variables in template ───────────────────────

export function substituteVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

// ─── Parse manual text input ────────────────────────────────

export function parseManualTexts(input: string): { template: string; variables: Record<string, string> }[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((template) => {
      // Extract {variable} names from template
      const varNames = new Set<string>();
      template.replace(/\{(\w+)\}/g, (_, key) => {
        varNames.add(key);
        return `{${key}}`;
      });

      return {
        template,
        variables: Object.fromEntries([...varNames].map((name) => [name, ""])),
      };
    });
}

// ─── Generate SRT subtitle file ─────────────────────────────

export function generateSRT(
  texts: { startTime: number; endTime: number; text: string }[],
  outputPath: string
): string {
  let srt = "";
  for (let i = 0; i < texts.length; i++) {
    const { startTime, endTime, text } = texts[i];
    srt += `${i + 1}\n`;
    srt += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
    srt += `${text}\n\n`;
  }
  return srt;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
