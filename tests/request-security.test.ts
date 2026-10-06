import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMutationBodySize,
  assertSameOriginMutation,
  mutationBodyLimitBytes
} from "../lib/security/request-policy";

test("safe methods do not require origin validation", () => {
  assert.doesNotThrow(() =>
    assertSameOriginMutation(
      { method: "GET", host: "ram.example" },
      { production: true }
    )
  );
});

test("production mutation requires same origin", () => {
  assert.doesNotThrow(() =>
    assertSameOriginMutation(
      {
        method: "POST",
        origin: "https://ram.example",
        host: "ram.example",
        forwardedProto: "https",
        secFetchSite: "same-origin"
      },
      { production: true }
    )
  );

  assert.throws(
    () =>
      assertSameOriginMutation(
        {
          method: "POST",
          origin: "https://evil.example",
          host: "ram.example",
          forwardedProto: "https"
        },
        { production: true }
      ),
    /same-origin/
  );
});

test("cross-site fetch metadata fails closed", () => {
  assert.throws(
    () =>
      assertSameOriginMutation(
        {
          method: "POST",
          origin: "https://ram.example",
          host: "ram.example",
          forwardedProto: "https",
          secFetchSite: "cross-site"
        },
        { production: true }
      ),
    /Cross-site/
  );
});

test("production mutation without origin or referer is rejected", () => {
  assert.throws(
    () =>
      assertSameOriginMutation(
        {
          method: "POST",
          host: "ram.example",
          forwardedProto: "https"
        },
        { production: true }
      ),
    /same-origin/
  );
});

test("mutation body limit rejects oversized requests", () => {
  assert.doesNotThrow(() =>
    assertMutationBodySize(
      { method: "POST", contentLength: "1024" },
      2048
    )
  );
  assert.throws(
    () =>
      assertMutationBodySize(
        { method: "POST", contentLength: "4096" },
        2048
      ),
    /exceeds configured limit/
  );
});


test("mutation body-limit configuration is bounded", () => {
  assert.equal(mutationBodyLimitBytes(undefined), 1_048_576);
  assert.equal(mutationBodyLimitBytes("65536"), 65_536);
  assert.throws(
    () => mutationBodyLimitBytes("0"),
    /must be an integer/
  );
  assert.throws(
    () => mutationBodyLimitBytes("not-a-number"),
    /must be an integer/
  );
});
