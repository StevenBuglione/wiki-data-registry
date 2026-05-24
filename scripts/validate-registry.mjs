import { readFile } from "node:fs/promises";

const OWNER = "StevenBuglione";

function fail(errors) {
	for (const error of errors) console.error(error);
	process.exit(1);
}

function assertObject(value, name, errors) {
	if (!value || typeof value !== "object" || Array.isArray(value)) errors.push(`${name} must be an object`);
}

function validateSource(source, seen, errors) {
	if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(source.id ?? "")) errors.push(`invalid source id: ${source.id}`);
	if (seen.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
	seen.add(source.id);
	for (const field of ["label", "description", "latestUrl"]) {
		if (!source[field]) errors.push(`${source.id}: missing ${field}`);
	}
	const expected = `https://cdn.jsdelivr.net/gh/${OWNER}/wiki-data-${source.id}@published/latest.json`;
	if (source.latestUrl !== expected) errors.push(`${source.id}: latestUrl must be ${expected}`);
	if (source.enabled !== true) errors.push(`${source.id}: enabled must be true`);
	if (!Number.isInteger(source.order)) errors.push(`${source.id}: order must be an integer`);
}

const errors = [];
const registry = JSON.parse(await readFile("sources.json", "utf8"));
const agent = JSON.parse(await readFile("agent-sources.json", "utf8"));
const taxonomy = JSON.parse(await readFile("taxonomy.json", "utf8"));

assertObject(registry, "sources.json", errors);
assertObject(agent, "agent-sources.json", errors);
assertObject(taxonomy, "taxonomy.json", errors);

if (registry.schemaVersion !== "steve-wiki-registry/v1") errors.push("sources.json: invalid schemaVersion");
if (registry.routeMode !== "query") errors.push("sources.json: routeMode must be query");
if (!Array.isArray(registry.sources)) errors.push("sources.json: sources must be an array");

const seen = new Set();
for (const source of registry.sources ?? []) validateSource(source, seen, errors);

if (agent.schemaVersion !== "steve-wiki-agent-sources/v1") errors.push("agent-sources.json: invalid schemaVersion");
if (!Array.isArray(agent.sources)) errors.push("agent-sources.json: sources must be an array");
const agentById = new Map((agent.sources ?? []).map(source => [source.id, source]));
for (const source of registry.sources ?? []) {
	const agentSource = agentById.get(source.id);
	if (!agentSource) {
		errors.push(`${source.id}: missing agent source`);
		continue;
	}
	if (agentSource.latestUrl !== source.latestUrl) errors.push(`${source.id}: agent latestUrl drift`);
	const expectedAgent = source.latestUrl.replace("latest.json", "latest-agent.json");
	if (agentSource.agentManifestUrl !== expectedAgent) {
		errors.push(`${source.id}: agentManifestUrl must be ${expectedAgent}`);
	}
}

if (taxonomy.schemaVersion !== "steve-wiki-taxonomy/v1") errors.push("taxonomy.json: invalid schemaVersion");
if (!taxonomy.facets?.status?.includes("draft")) errors.push("taxonomy.json: missing status facet values");
if (!taxonomy.facets?.difficulty?.includes("beginner")) errors.push("taxonomy.json: missing difficulty facet values");

if (errors.length) fail(errors);
console.log(`registry validation ok (${registry.sources.length} source(s))`);
