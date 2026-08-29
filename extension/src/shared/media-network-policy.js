(function installMediaNetworkPolicy(scope) {
  function isPrivateNetworkMediaUrl(rawUrl = "") {
    let hostname = "";
    try {
      const url = new URL(String(rawUrl || ""));
      if (!["http:", "https:"].includes(url.protocol)) {
        return false;
      }
      hostname = url.hostname
        .toLowerCase()
        .replace(/^\[|\]$/g, "")
        .replace(/\.+$/, "");
    } catch {
      return false;
    }
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
        hostname.endsWith(".lan") || hostname.endsWith(".internal") || hostname.endsWith(".home") ||
        hostname.endsWith(".home.arpa")) {
      return true;
    }
    return isPrivateNetworkAddress(hostname);
  }

  function isPrivateNetworkAddress(rawAddress = "") {
    let address = String(rawAddress || "")
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .split("%", 1)[0];
    const ipv4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (ipv4Mapped) {
      address = ipv4Mapped[1];
    } else if (address.startsWith("::ffff:")) {
      return true;
    }
    if (address.includes(":")) {
      return isPrivateIpv6Literal(address);
    }
    return isPrivateIpv4Address(address);
  }

  function isPrivateIpv4Address(address = "") {
    const octets = String(address || "").split(".").map(Number);
    if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
      return false;
    }
    const [first, second, third] = octets;
    return first === 0 || first === 10 || first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0 && third === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224;
  }

  function isPrivateIpv6Literal(hostname = "") {
    const normalized = String(hostname || "").toLowerCase().split("%", 1)[0];
    const groups = parseIpv6Groups(normalized);
    if (!groups) {
      return false;
    }
    const first = groups[0];
    const unspecified = groups.every(value => value === 0);
    const loopback = groups.slice(0, 7).every(value => value === 0) && groups[7] === 1;
    const ipv4Mapped = groups.slice(0, 5).every(value => value === 0) && groups[5] === 0xffff;
    if (ipv4Mapped) {
      const embedded = `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
      return isPrivateIpv4Address(embedded);
    }
    return unspecified || loopback ||
      (first & 0xffc0) === 0xfe80 ||
      (first & 0xfe00) === 0xfc00 ||
      (first & 0xff00) === 0xff00;
  }

  function parseIpv6Groups(address = "") {
    let text = String(address || "");
    const ipv4Tail = text.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1] || "";
    const tailGroups = [];
    if (ipv4Tail) {
      const octets = ipv4Tail.split(".").map(Number);
      if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
        return null;
      }
      tailGroups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      text = text.slice(0, -ipv4Tail.length).replace(/:$/, "");
    }
    const halves = text.split("::");
    if (halves.length > 2) {
      return null;
    }
    const parseHalf = value => value
      ? value.split(":").filter(Boolean).map(group => /^[0-9a-f]{1,4}$/i.test(group) ? Number.parseInt(group, 16) : Number.NaN)
      : [];
    const left = parseHalf(halves[0]);
    const right = parseHalf(halves[1] || "");
    if ([...left, ...right].some(value => !Number.isInteger(value))) {
      return null;
    }
    const explicitCount = left.length + right.length + tailGroups.length;
    const compressedCount = halves.length === 2 ? 8 - explicitCount : 0;
    if (explicitCount > 8 || (halves.length === 1 && explicitCount !== 8) || compressedCount < 0) {
      return null;
    }
    return [...left, ...Array(compressedCount).fill(0), ...right, ...tailGroups];
  }

  function privateNetworkMediaOrigin(rawUrl = "") {
    if (!isPrivateNetworkMediaUrl(rawUrl)) {
      return "";
    }
    try {
      return new URL(String(rawUrl || "")).origin;
    } catch {
      return "";
    }
  }

  scope.FuguangMediaNetworkPolicy = Object.freeze({
    isPrivateNetworkAddress,
    isPrivateNetworkMediaUrl,
    privateNetworkMediaOrigin
  });
})(globalThis);
