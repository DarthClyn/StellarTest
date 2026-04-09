import { contract } from "@stellar/stellar-sdk";

let isPatched = false;

function usesHttpRpc(rpcUrl) {
  if (typeof rpcUrl !== "string" || !rpcUrl) {
    return false;
  }

  try {
    return new URL(rpcUrl).protocol === "http:";
  } catch {
    return false;
  }
}

export function enableAllowHttpForInsecureSorobanRpc() {
  if (isPatched) {
    return;
  }

  const originalBuild = contract.AssembledTransaction.build;

  contract.AssembledTransaction.build = function patchedBuild(options, ...rest) {
    if (usesHttpRpc(options?.rpcUrl) && typeof options.allowHttp === "undefined") {
      return originalBuild.call(this, { ...options, allowHttp: true }, ...rest);
    }

    return originalBuild.call(this, options, ...rest);
  };

  isPatched = true;
}
