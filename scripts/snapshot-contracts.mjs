// Narrow source snapshot utility for the positional records in the inspected backend.
// Not an OpenAPI generator: rejects unsupported types and requires human serializer review.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('Pass the backend checkout directory.');
const groups = {
  'short-run-macro': ['src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroTypes.cs', 'src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroScenarioAuthoring.cs', 'src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroClassroomGameplay.cs'],
  'competitive-market': ['src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketTypes.cs', 'src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketAuthoring.cs', 'src/SimulationPlatform.Simulations.Economics/CompetitiveMarket/CompetitiveMarketGameplay.cs'],
  'analytics-replay': ['src/SimulationPlatform.Simulations.Economics/Macroeconomics/MacroLearningAnalytics.cs', 'src/SimulationPlatform.Application/Assessment/AssessmentCommentContracts.cs'],
};
const owners = new Map([['ScenarioDraftDocument', 'scenarios'], ['HistoryItem', 'sessions'], ['SubmissionInspection', 'sessions'], ['JsonValue', 'platform']]);
const declarations = new Map();
function split(text) {
  let depth = 0, start = 0; const out = [];
  for (let i = 0; i < text.length; i++) { if ('<(['.includes(text[i])) depth++; if ('>)]'.includes(text[i])) depth--; if (text[i] === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; } }
  out.push(text.slice(start).trim()); return out;
}
for (const [group, paths] of Object.entries(groups)) {
  const entries = [];
  for (const path of paths) {
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const match of source.matchAll(/public sealed record (\w+)\(([\s\S]*?)\);/g)) {
      if (match[1] === 'MacroMechanismContext') continue;
      entries.push({ name: match[1], params: split(match[2]), path }); owners.set(match[1], group);
    }
    for (const match of source.matchAll(/public enum (\w+)\s*\{([^}]+)\}/g)) {
      const names = split(match[2]).map(x => x.split('=')[0].trim());
      const isString = source.includes(`JsonStringEnumConverter<${match[1]}>`);
      entries.push({ name: match[1], enumValues: names.map((x, i) => isString ? JSON.stringify(x) : `${i} /* ${x} */`), path }); owners.set(match[1], group);
    }
  }
  declarations.set(group, entries);
}
const primitive = { Guid: 'string', string: 'string', bool: 'boolean', int: 'number', long: 'number', decimal: 'number', DateTimeOffset: 'string', JsonElement: 'JsonValue' };
for (const [group, entries] of declarations) {
  const imports = new Map();
  function type(raw) {
    if (raw.endsWith('?')) return `${type(raw.slice(0, -1))} | null`;
    const generic = raw.match(/^(\w+)<(.+)>$/);
    if (generic) { const args = split(generic[2]); if (['List', 'HashSet', 'IReadOnlyList'].includes(generic[1])) return `Array<${type(args[0])}>`; if (generic[1] === 'Dictionary') return `Record<${type(args[0])}, ${type(args[1])}>`; throw new Error(raw); }
    const mapped = primitive[raw] || raw;
    const owner = owners.get(mapped);
    if (owner && owner !== group) { if (!imports.has(owner)) imports.set(owner, new Set()); imports.get(owner).add(mapped); }
    if (!owner && !['string', 'number', 'boolean'].includes(mapped)) throw new Error(`Unknown type ${raw}`);
    return mapped;
  }
  const body = entries.map(entry => {
    if (entry.enumValues) return `// ${entry.path}\nexport type ${entry.name} = ${entry.enumValues.join(' | ')};`;
    const fields = entry.params.map(param => {
      const declaration = param.split('=')[0].trim(); const space = declaration.lastIndexOf(' ');
      const raw = declaration.slice(0, space), name = declaration.slice(space + 1);
      return `  ${name[0].toLowerCase() + name.slice(1)}: ${type(raw)};`;
    });
    return `// ${entry.path}\nexport interface ${entry.name} {\n${fields.join('\n')}\n}`;
  });
  const header = '// Source snapshot. Serializer-reviewed numeric assessment enums intentionally differ from handoff.\n';
  mkdirSync('src/types', { recursive: true });
  writeFileSync(`src/types/${group}.ts`, header + [...imports].map(([owner, names]) => `import type { ${[...names].join(', ')} } from './${owner}';`).join('\n') + '\n\n' + body.join('\n\n') + '\n');
}
