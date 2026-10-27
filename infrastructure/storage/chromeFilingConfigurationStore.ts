import {
  parseFilingConfiguration,
  type ConfigurationParseResult,
  type FilingConfiguration,
} from '../../features/bookmark-filing/configuration';

export const FILING_CONFIGURATION_STORAGE_KEY =
  'smartBookmarkFiler.filingConfiguration';

export interface LocalStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export type ApiKeyUpdate =
  | { readonly kind: 'preserve' }
  | { readonly kind: 'replace'; readonly apiKey: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ChromeFilingConfigurationStore {
  constructor(private readonly storage: LocalStorageArea) {}

  async load(): Promise<FilingConfiguration | null> {
    const storedValues = await this.storage.get(
      FILING_CONFIGURATION_STORAGE_KEY,
    );
    const result = parseFilingConfiguration(
      storedValues[FILING_CONFIGURATION_STORAGE_KEY],
    );

    return result.ok ? result.value : null;
  }

  async save(
    draft: unknown,
    apiKeyUpdate: ApiKeyUpdate,
  ): Promise<ConfigurationParseResult> {
    const currentConfiguration = await this.load();
    const apiKey =
      apiKeyUpdate.kind === 'replace'
        ? apiKeyUpdate.apiKey
        : (currentConfiguration?.openAiApiKey ?? '');
    const candidate = {
      ...(isRecord(draft) ? draft : {}),
      openAiApiKey: apiKey,
    };
    const result = parseFilingConfiguration(candidate);

    if (!result.ok) {
      return result;
    }

    await this.storage.set({
      [FILING_CONFIGURATION_STORAGE_KEY]: result.value,
    });
    return result;
  }

  async clearApiKey(): Promise<void> {
    await this.storage.remove(FILING_CONFIGURATION_STORAGE_KEY);
  }
}

export function createChromeLocalFilingConfigurationStore(): ChromeFilingConfigurationStore {
  return new ChromeFilingConfigurationStore(browser.storage.local);
}
