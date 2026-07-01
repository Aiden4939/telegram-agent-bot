import { env } from "../config/env.js";
import type { PortfolioSnapshot } from "../types/securities.js";
import { mapNovaInventoriesToHoldings } from "./novaPositionMapper.js";

export class SecuritiesServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecuritiesServiceError";
  }
}

interface TaishinAccount {
  account: string;
  name?: string;
  branchName?: string;
}

interface TaishinSdkInstance {
  login: (
    nationalId: string,
    password: string,
    certPath: string,
    certPassword?: string | null
  ) => TaishinAccount[];
  accounting: {
    inventories: (account: TaishinAccount) => {
      positionSummaries?: Array<Record<string, string | undefined>>;
    };
  };
}

interface TaishinSdkModule {
  TaishinSDK: new (apiUrl?: string | null) => TaishinSdkInstance;
}

type SdkSession = {
  sdk: TaishinSdkInstance;
  account: TaishinAccount;
};

let cachedSdk: TaishinSdkInstance | null = null;
let cachedAccounts: TaishinAccount[] | null = null;
let sessionInit: Promise<SdkSession> | null = null;

export function isTaishinSecuritiesEnabled(): boolean {
  return env.taishinEnabled && env.taishinConfigured;
}

function getAccountId(account: TaishinAccount): string {
  return account.account.trim();
}

async function loadSdkModule(): Promise<TaishinSdkModule> {
  try {
    return (await import("taishin-sdk")) as TaishinSdkModule;
  } catch {
    throw new SecuritiesServiceError(
      "未安裝 taishin-sdk。請確認 vendor/taishin-sdk-1.0.2.tgz 存在並已執行 npm install。"
    );
  }
}

function pickAccount(accounts: TaishinAccount[]): TaishinAccount {
  if (!env.taishinAccountId) {
    return accounts[0];
  }

  const matched = accounts.find(
    (account) => getAccountId(account) === env.taishinAccountId
  );
  if (!matched) {
    throw new SecuritiesServiceError(
      `找不到 TAISHIN_ACCOUNT_ID=${env.taishinAccountId} 對應的證券帳號。`
    );
  }
  return matched;
}

async function createSdkSession(): Promise<SdkSession> {
  const module = await loadSdkModule();
  const sdk = new module.TaishinSDK();
  const accounts = sdk.login(
    env.taishinNationalId,
    env.taishinPassword,
    env.taishinCertPath,
    env.taishinCertPassword
  );

  if (!accounts?.length) {
    throw new SecuritiesServiceError("台新 API 登入成功但未取得任何帳號。");
  }

  cachedSdk = sdk;
  cachedAccounts = accounts;
  return { sdk, account: pickAccount(accounts) };
}

async function ensureSdkSession(): Promise<SdkSession> {
  if (!isTaishinSecuritiesEnabled()) {
    throw new SecuritiesServiceError(
      "台新證券查詢未啟用。請設定 TAISHIN_ENABLED=true 並補齊憑證相關環境變數。"
    );
  }

  if (cachedSdk && cachedAccounts?.length) {
    return { sdk: cachedSdk, account: pickAccount(cachedAccounts) };
  }

  if (!sessionInit) {
    sessionInit = createSdkSession().finally(() => {
      sessionInit = null;
    });
  }

  return sessionInit;
}

export async function queryPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  try {
    const { sdk, account } = await ensureSdkSession();
    const response = sdk.accounting.inventories(account);
    const holdings = mapNovaInventoriesToHoldings(response);

    return {
      holdings,
      queriedAt: new Date(),
    };
  } catch (error) {
    resetTaishinSdkSession();
    throw error;
  }
}

export function resetTaishinSdkSession(): void {
  cachedSdk = null;
  cachedAccounts = null;
  sessionInit = null;
}
