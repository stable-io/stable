import { serializeBigints, deserializeBigints } from "@stable-io/utils";

// Example of BigInt serialization for JSON payloads
const originalData = {
  userBalance: 1000000000000000000n,
  nonce: 42n,
  deadline: 1703980800n,
  metadata: {
    chainId: 1n,
    amounts: [100n, 200n, 300n],
  },
};

console.info("Original data:", originalData);
console.info("Original types:", {
  userBalance: typeof originalData.userBalance,
  nonce: typeof originalData.nonce,
});

// Serialize for JSON (what gets stored/transmitted)
const jsonSafePayload = serializeBigints(originalData);
console.info("JSON-safe payload:", jsonSafePayload);

// Deserialize back from JSON (restore BigInt types)
const parsedBack = deserializeBigints<typeof originalData>(jsonSafePayload);
console.info("Parsed back:", parsedBack);
console.info("Restored types:", {
  userBalance: typeof parsedBack.userBalance,
  nonce: typeof parsedBack.nonce,
});
console.info(
  "Values match:",
  parsedBack.userBalance === originalData.userBalance,
);
