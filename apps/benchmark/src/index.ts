// Benchmark runner entry point.
// Gate 1 executes through Vitest so the run is deterministic and CI-reproducible:
//   npx vitest run tests/benchmark/gate1-benchmark.test.ts
// See apps/benchmark/src/gate1.ts for the declared thresholds and
// docs/gates/gate-1/08_BENCHMARK_REPORT.md for measured results.
export * from "./gate1";

console.log("PHLI Benchmark — Gate 1 runs via tests/benchmark/gate1-benchmark.test.ts");
