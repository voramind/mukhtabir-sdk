import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";
import { describe, it } from "vitest";

const srcDir = fileURLToPath(new URL("../../src/", import.meta.url));

type Finding = {
  file: string;
  line: number;
  column: number;
  expression: string;
};

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectTypeScriptFiles(entryPath);
    }

    return entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

function collectForbiddenLoggingUsages(filePath: string): Finding[] {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const findings: Finding[] = [];

  const addFinding = (node: ts.Node, expression: string) => {
    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    findings.push({
      file: path.relative(srcDir, filePath),
      line: position.line + 1,
      column: position.character + 1,
      expression,
    });
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "console"
    ) {
      addFinding(node, `console.${node.name.text}`);
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "process" &&
      (node.expression.name.text === "stdout" ||
        node.expression.name.text === "stderr") &&
      node.name.text === "write"
    ) {
      addFinding(node, `process.${node.expression.name.text}.write`);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return findings;
}

describe("runtime logging guardrail", () => {
  it("does not allow console or stdio logging in src", () => {
    const findings = collectTypeScriptFiles(srcDir).flatMap(
      collectForbiddenLoggingUsages,
    );

    if (findings.length > 0) {
      const message = findings
        .map(
          (finding) =>
            `${finding.file}:${finding.line}:${finding.column} uses ${finding.expression}`,
        )
        .join("\n");
      throw new Error(`Unexpected runtime logging usage:\n${message}`);
    }
  });
});
