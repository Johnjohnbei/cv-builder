import { describe, it, expect } from "vitest";
import { isPublicAddress, isPublicUrl, parseHttpUrl } from "../publicUrl";

const resolvesTo = (...addresses: string[]) => async () => addresses.map((address) => ({ address }));

const neverResolves = async (): Promise<never> => {
  throw new Error("must not be resolved");
};

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "::ffff:7f00:1", "::a9fe:a9fe", "64:ff9b::a9fe:a9fe", "fd00::1", "febf::1", "fe80::1",
    "64:ff9b:1::a9fe:a9fe", "::ffff:0:7f00:1", "2002:a9fe:a9fe::1", "2002:7f00:1::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2", "fec0::1",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700::6810:84e5", "2001:4860:4860::8888"])("accepts %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it("refuses what is not an address", () => {
    expect(isPublicAddress("example.com")).toBe(false);
  });
});

describe("parseHttpUrl (offline, before the access code)", () => {
  it("keeps an http(s) link, trimmed", () => {
    expect(parseHttpUrl(" https://jobs.example/offre/42 ")?.toString()).toBe("https://jobs.example/offre/42");
  });

  it.each([
    "ftp://jobs.example/",
    "https://user:pass@jobs.example/",
    "not a url",
    "http://[64:ff9b::a9fe:a9fe]/",
    "http://[::ffff:127.0.0.1]/",
    "http://0x7f.1/",
    "http://100.64.0.1/",
    "http://localhost:3000/",
    "http://app.localhost/",
    "http://localhost./",
    "http://foo.localhost./",
    "http://metadata.google.internal/",
    "http://printer.local/",
    "http://nas.home.arpa/",
    "http://localhost../",
    "http://x.local../",
    "http://metadata/",
    "http://instance-data/",
    "http://127.1../",
    "http://0x7f.1../",
    "http://a.1../",
    "http://1.2.3.4.5../",
    "http://256.0.0.1../",
  ])("refuses %s", (raw) => {
    expect(parseHttpUrl(raw)).toBeNull();
  });

  it("drops trailing dots from the host it returns, so the host fetched is the host checked", () => {
    expect(parseHttpUrl("http://8.8.8.8../offre")?.hostname).toBe("8.8.8.8");
    expect(parseHttpUrl("https://jobs.example../offre?id=1")?.toString()).toBe("https://jobs.example/offre?id=1");
  });

  it("keeps a public literal address, and a name that merely contains a reserved word", () => {
    expect(parseHttpUrl("http://8.8.8.8/")).not.toBeNull();
    expect(parseHttpUrl("https://local-jobs.example/")).not.toBeNull();
    expect(parseHttpUrl("https://internal.example/")).not.toBeNull();
  });
});

describe("isPublicUrl (DNS, after the access code)", () => {
  const url = (raw: string) => parseHttpUrl(raw)!;

  it("accepts a name that only resolves to public addresses", async () => {
    expect(await isPublicUrl(url("https://jobs.example/"), resolvesTo("93.184.216.34"))).toBe(true);
  });

  it("refuses a name with any private address among its answers", async () => {
    expect(await isPublicUrl(url("https://jobs.example/"), resolvesTo("93.184.216.34", "10.0.0.1"))).toBe(false);
  });

  it("refuses a name that does not resolve", async () => {
    expect(await isPublicUrl(url("https://nowhere.example/"), neverResolves)).toBe(false);
  });

  it("accepts a public literal address without resolving it", async () => {
    const resolved: string[] = [];
    const spy = async (host: string) => {
      resolved.push(host);
      return [];
    };
    expect(await isPublicUrl(url("http://8.8.8.8/"), spy)).toBe(true);
    expect(await isPublicUrl(url("http://8.8.8.8../"), spy)).toBe(true);
    expect(resolved).toEqual([]);
  });
});
