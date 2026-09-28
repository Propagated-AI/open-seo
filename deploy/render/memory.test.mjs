import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatus, descendants } from "./memory.mjs";

test("reads only process identity and RSS, converting KiB to bytes", () => {
  assert.deepEqual(
    parseStatus("Name:\tworkerd\nPid:\t180\nPPid:\t149\nVmRSS:\t658136 kB\n"),
    {
      pid: 180,
      parentPid: 149,
      name: "workerd",
      rssBytes: 673931264,
    },
  );
});

test("includes nested descendants regardless of scan order and excludes unrelated processes", () => {
  const processes = [
    { pid: 4, parentPid: 3 },
    { pid: 3, parentPid: 2 },
    { pid: 9, parentPid: 1 },
    { pid: 2, parentPid: 1 },
    { pid: 1, parentPid: 0 },
  ];
  assert.deepEqual(
    descendants(processes, 2).map((p) => p.pid),
    [4, 3, 2],
  );
});

test("handles an exiting process without an RSS field", () => {
  assert.equal(
    parseStatus("Name:\tworkerd\nPid:\t180\nPPid:\t149\n").rssBytes,
    0,
  );
});
