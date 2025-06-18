import { prepareJwtPayload, parseJwtPayload } from "../src/common/utils";

// Example of BigInt serialization for JWT payloads
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

// Prepare for JWT (what gets signed)
const jwtSafePayload = prepareJwtPayload(originalData);
console.info("JWT-safe payload:", jwtSafePayload);

// Parse back from JWT (restore BigInt types)
const parsedBack = parseJwtPayload<typeof originalData>(jwtSafePayload);
console.info("Parsed back:", parsedBack);
console.info("Restored types:", {
  userBalance: typeof parsedBack.userBalance,
  nonce: typeof parsedBack.nonce,
});
console.info(
  "Values match:",
  parsedBack.userBalance === originalData.userBalance,
);
