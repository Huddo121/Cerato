import type { NonContentfulResponseCode, ResponseCode } from "./Endpoint";

export const isNonContentfulResponseCode = (
  status: ResponseCode,
): status is NonContentfulResponseCode => {
  return [204].includes(status);
};
