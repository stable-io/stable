export const env = {
  dynamicEnvironmentId: process.env["NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID"]!,
  dynamicApiBaseUrl: process.env["NEXT_PUBLIC_DYNAMIC_API_BASE_URL"],
} as const;
