import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
export const validPin = (pin: unknown): pin is string => typeof pin === "string" && /^\d{6}$/.test(pin);
export async function hashPin(pin: string, salt = randomBytes(32).toString("hex")) {
  const hash = await new Promise<Buffer>((resolve, reject) => scryptCallback(pin, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
  return { salt, hash: hash.toString("hex") };
}
export async function verifyPin(pin: string, salt: string, expected: string) {
  const actual = await hashPin(pin, salt); const a = Buffer.from(actual.hash, "hex"); const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const rateKey = (secret: string, key: string) => createHmac("sha256", secret).update(key).digest("hex");
