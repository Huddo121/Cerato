import type { NonContentfulResponseCode, ResponseCode } from "./Endpoint";

export const isNonContentfulResponseCode = (
  status: ResponseCode,
): status is NonContentfulResponseCode => {
  return status === 204;
};
